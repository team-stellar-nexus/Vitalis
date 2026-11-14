import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

# ── Ensure imports work regardless of run directory ──
sys.path.insert(0, str(Path(__file__).resolve().parent))   # src/ (contains data/ and models/)

from data.loader import load_dataset
from data.wesad_loader import load_wesad
from metrics import summarize, balanced_accuracy
from data.preprocessor import preprocess_participant, WINDOW_SAMPLES
from data.dataset import build_datasets, make_dataloader, AstronautHealthDataset
from models.encoder import HealthClassifier


# ── Config ──────────────────────────────────────────────────────────────────
class TrainConfig:
    # Data
    signal_key:     str   = "E4_BVP"     # Which signal to train on
    val_pids:       list  = None         # Auto-select if None
    test_pids:      list  = None

    # Training
    epochs:         int   = 50
    batch_size:     int   = 32
    learning_rate:  float = 1e-3
    weight_decay:   float = 1e-4
    embedding_dim:  int   = 128
    num_classes:    int   = 3            # low / moderate / high stress

    # Output
    save_dir:       str   = str(Path(__file__).resolve().parent.parent / "artifacts")
    device:         str   = ("cuda" if torch.cuda.is_available() else "cpu")


# ── Training step ────────────────────────────────────────────────────────────

def train_one_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct    = 0
    total      = 0

    for batch_x, batch_y in dataloader:
        batch_x = batch_x.to(device)
        batch_y = batch_y.to(device)

        logits, _ = model(batch_x)
        loss = criterion(logits, batch_y)

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss += loss.item() * batch_x.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == batch_y).sum().item()
        total += batch_x.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, dataloader, criterion, device):
    model.eval()
    total_loss = 0
    correct    = 0
    total      = 0
    all_preds  = []
    all_labels = []

    for batch_x, batch_y in dataloader:
        batch_x = batch_x.to(device)
        batch_y = batch_y.to(device)

        logits, _ = model(batch_x)
        loss = criterion(logits, batch_y)

        total_loss += loss.item() * batch_x.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == batch_y).sum().item()
        total += batch_x.size(0)

        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(batch_y.cpu().numpy())

    acc = correct / total if total > 0 else 0
    return total_loss / max(total, 1), acc, np.array(all_preds), np.array(all_labels)


# ── Main training loop ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train Astronaut Health Encoder")
    parser.add_argument("--dataset", type=str,
                        default=str(Path(__file__).resolve().parents[1] / "Dataset"),   # <repo root>/Dataset
                        help="Path to Dataset/ folder")
    parser.add_argument("--signal", type=str, default="E4_BVP",
                        help="Signal to train on: E4_BVP, PolarH10_ECG, etc.")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--wesad", type=str, default=None, help="Path to WESAD folder (optional)")
    parser.add_argument("--binary", action="store_true", help="2 classes: stress vs not stress")
    parser.add_argument("--val", type=str, default=None, help="comma-separated participant ids")
    parser.add_argument("--test", type=str, default=None, help="comma-separated ids; WESAD_ALL = every WESAD subject")
    parser.add_argument("--out", type=str, default=None, help="output folder (default final/artifacts)")
    args = parser.parse_args()

    config = TrainConfig()
    config.signal_key = args.signal
    config.epochs = args.epochs
    config.batch_size = args.batch_size
    config.learning_rate = args.lr
    if args.out:
        config.save_dir = args.out
    if args.wesad and not (args.val and args.test):
        sys.exit("When using --wesad, pass --val and --test explicitly, "
                 "e.g. --val P07,P14,P21 --test WESAD_ALL")

    device = torch.device(config.device)
    print(f"\n╔══════════════════════════════════════════════╗")
    print(f"║  Astronaut Health Encoder — Training         ║")
    print(f"╠══════════════════════════════════════════════╣")
    print(f"║  Signal:  {config.signal_key:<35}║")
    print(f"║  Device:  {config.device:<35}║")
    print(f"║  Epochs:  {config.epochs:<35}║")
    print(f"║  Batch:   {config.batch_size:<35}║")
    print(f"║  LR:      {config.learning_rate:<35}║")
    print(f"╚══════════════════════════════════════════════╝\n")

    # ── Step 1: Load raw data ────────────────────────────────────────────
    print("🔄 Step 1: Loading raw data...")
    raw_data = load_dataset(args.dataset, only=[config.signal_key])
    print()

    # ── Step 2: Preprocess all participants ──────────────────────────────
    print("🔄 Step 2: Preprocessing and creating windows...")
    processed = {}
    for pid, pdata in raw_data.items():
        print(f"  Processing {pid}:")
        processed[pid] = preprocess_participant(pdata, pid)
    print()

    # ── Step 3: Build train / val / test datasets ────────────────────────
    if args.wesad:
        print("  Adding WESAD...")
        processed.update(load_wesad(args.wesad, config.signal_key))

    if args.binary:      # stress (2) vs everything else
        config.num_classes = 2
        for pid in list(processed):
            for key, (w, l) in list(processed[pid]["windows"].items()):
                processed[pid]["windows"][key] = (w, (l == 2).astype(np.int64))

    def _ids(arg):
        if not arg:
            return None
        out = []
        for tok in arg.split(","):
            out += [p for p in processed if p.startswith("WESAD_")] if tok == "WESAD_ALL" else [tok.strip()]
        return out
    config.val_pids, config.test_pids = _ids(args.val), _ids(args.test)

    print("🔄 Step 3: Building datasets...")
    train_ds, val_ds, test_ds = build_datasets(
        processed,
        signal_key=config.signal_key,
        val_participants=config.val_pids,
        test_participants=config.test_pids
    )

    if len(train_ds) == 0:
        print("❌ No training windows found. Check dataset path and signal key.")
        sys.exit(1)

    train_loader = make_dataloader(train_ds, config.batch_size, balanced=True)
    val_loader   = make_dataloader(val_ds,   config.batch_size, balanced=False, shuffle=False)
    test_loader  = make_dataloader(test_ds,  config.batch_size, balanced=False, shuffle=False)
    print()

    # ── Step 4: Initialize model ──────────────────────────────────────────
    model = HealthClassifier(
        embedding_dim=config.embedding_dim,
        num_classes=config.num_classes
    ).to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = AdamW(model.parameters(), lr=config.learning_rate,
                      weight_decay=config.weight_decay)
    scheduler = CosineAnnealingLR(optimizer, T_max=config.epochs, eta_min=1e-6)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"📊 Model: {total_params:,} parameters")
    print()

    # ── Step 5: Training loop ─────────────────────────────────────────────
    print("🔄 Step 4: Training...")
    best_val_acc = 0
    best_epoch   = 0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    for epoch in range(1, config.epochs + 1):
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        val_loss, val_acc, val_preds, val_labels = evaluate(
            model, val_loader, criterion, device
        )
        val_bal = balanced_accuracy(val_labels, val_preds, config.num_classes)
        scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        lr = optimizer.param_groups[0]["lr"]
        bar = "█" * int(train_acc * 30) + "░" * (30 - int(train_acc * 30))
        print(f"  Epoch {epoch:3d}/{config.epochs} │ "
              f"Train {train_loss:.4f} ({train_acc:.1%}) │ "
              f"Val {val_loss:.4f} ({val_acc:.1%}) │ "
              f"LR {lr:.1e} │ {bar}")

        # Save best model
        if val_bal > best_val_acc or best_epoch == 0:   # always keep a checkpoint
            best_val_acc = val_bal
            best_epoch   = epoch
            os.makedirs(config.save_dir, exist_ok=True)
            torch.save(model.state_dict(),
                       os.path.join(config.save_dir, "best_model.pt"))
            torch.save(model.encoder.state_dict(),
                       os.path.join(config.save_dir, "best_encoder.pt"))

    print(f"\n✅ Best validation balanced accuracy: {best_val_acc:.1%} (epoch {best_epoch})")

    # ── Step 6: Evaluate on test set ──────────────────────────────────────
    print("\n🔄 Step 5: Evaluating on test set...")
    model.load_state_dict(torch.load(os.path.join(config.save_dir, "best_model.pt"),
                                     weights_only=True))
    test_loss, test_acc, preds, labels = evaluate(
        model, test_loader, criterion, device
    )

    print(f"\n╔══════════════════════════════════════════════╗")
    print(f"║  TEST RESULTS                                ║")
    print(f"╠══════════════════════════════════════════════╣")
    print(f"║  Accuracy:  {test_acc:.1%}{'':<29}║")
    print(f"║  Loss:      {test_loss:.4f}{'':<29}║")

    # Per-class accuracy
    for cls in range(config.num_classes):
        mask = labels == cls
        if mask.sum() > 0:
            cls_acc = (preds[mask] == cls).mean()
            cls_name = (["Not stress", "Stress    "] if config.num_classes == 2 else ["Low stress", "Moderate ", "High stress"])[cls]
            print(f"║  {cls_name}: {cls_acc:.1%} ({mask.sum()} windows){'':<14}║")

    print(f"╚══════════════════════════════════════════════╝")

    # Save training history
    with open(os.path.join(config.save_dir, "history.json"), "w") as f:
        json.dump(history, f, indent=2)

    # ── Per-dataset breakdown on the test participants ──
    test_ids = config.test_pids or [list(processed)[-1]]
    groups = {}
    for pid in test_ids:
        w, l = processed.get(pid, {}).get("windows", {}).get(config.signal_key, (None, None))
        if w is None or len(w) == 0:
            continue
        _, _, p_, y_ = evaluate(model, make_dataloader(AstronautHealthDataset(w, l), config.batch_size,
                                                       balanced=False, shuffle=False), criterion, device)
        g = "WESAD" if pid.startswith("WESAD_") else "GalaxyPPG"
        groups.setdefault(g, ([], []))
        groups[g][0].extend(y_.tolist()); groups[g][1].extend(p_.tolist())
    per_dataset = {g: summarize(y_, p_, config.num_classes) for g, (y_, p_) in groups.items()}
    overall = summarize(labels, preds, config.num_classes)
    print("\nPer-dataset test results:")
    for g, m in per_dataset.items():
        print(f"  {g}: balanced acc {m['balanced_accuracy']:.1%} (chance {m['chance_balanced_accuracy']:.1%}), "
              f"accuracy {m['accuracy']:.1%} (always-majority {m['majority_class_baseline']:.1%})  ({m['n_windows']} windows)")

    classes = ["not stress", "stress"] if config.num_classes == 2 else ["low", "moderate", "high"]
    with open(os.path.join(config.save_dir, "metrics.json"), "w") as f:
        json.dump({"test_overall": overall, "test_per_dataset": per_dataset,
                   "best_val_balanced_accuracy": best_val_acc, "best_epoch": best_epoch}, f, indent=2)
    card = {
        "name": "Astronaut Health Encoder (HealthClassifier, 1D-CNN residual encoder + linear head)",
        "created": datetime.now().isoformat(timespec="seconds"),
        "intended_use": "Stress-pattern indicator from wrist PPG/BVP for a hackathon prototype. Decision support only, not a medical device.",
        "input": {"signal": config.signal_key, "window_seconds": 30, "sample_rate_hz": 25,
                  "samples": WINDOW_SAMPLES, "preprocessing": "band-pass 0.5-8 Hz, resample to 25 Hz, per-window z-score"},
        "classes": classes,
        "training_data": {"GalaxyPPG": True, "WESAD": bool(args.wesad)},
        "split": {"val": config.val_pids or "default: second-to-last participant",
                  "test": config.test_pids or "default: last participant"},
        "parameters": total_params,
        "metrics_file": "metrics.json",
        "limitations": ["Lab-study data, not spaceflight data",
                        "Small held-out sets (a few participants)",
                        "Class 'moderate' mixes several different tasks",
                        "Compare balanced accuracy against the majority-class baseline in metrics.json"],
    }
    with open(os.path.join(config.save_dir, "model_card.json"), "w") as f:
        json.dump(card, f, indent=2)

    print(f"\n💾 Saved:")
    print(f"  - {config.save_dir}/best_model.pt   (full model)")
    print(f"  - {config.save_dir}/best_encoder.pt  (encoder only, for downstream)")
    print(f"  - {config.save_dir}/history.json     (training curves)")
    print(f"\nDone! 🚀")


if __name__ == "__main__":
    main()
