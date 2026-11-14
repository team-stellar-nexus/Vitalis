"""
train_autoencoder.py - GWAK-style unsupervised anomaly detector (the "autoencoder for unmodelled signals" idea).

Trains the 1D convolutional autoencoder ONLY on calm ("low stress", label 0) 30 s PPG windows, then scores held-out
windows by reconstruction error. High error = the window does not look like calm PPG.

Usage (from the repo root, put this file in src/):
    python src/train_autoencoder.py --epochs 40 --val P07,P14,P21 --test P10,P17,P24
Writes artifacts/autoencoder.pt and artifacts/autoencoder_metrics.json
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data.loader import load_dataset
from data.preprocessor import preprocess_participant
from models.autoencoder import ConvAutoencoder1D, compute_reconstruction_errors

ROOT = Path(__file__).resolve().parents[1]


def collect(windows, ids):
    xs, ys = [], []
    for pid in ids:
        w, l = windows.get(pid, (np.empty((0, 750), np.float32), np.empty((0,), np.int64)))
        if len(w):
            xs.append(w); ys.append(l)
    if not xs:
        return np.empty((0, 750), np.float32), np.empty((0,), np.int64)
    return np.concatenate(xs).astype(np.float32), np.concatenate(ys)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default=str(ROOT / "Dataset"))
    ap.add_argument("--signal", default="E4_BVP")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--patience", type=int, default=6)
    ap.add_argument("--val", required=True, help="comma-separated participant ids")
    ap.add_argument("--test", required=True, help="comma-separated participant ids")
    ap.add_argument("--out", default=str(ROOT / "artifacts"))
    a = ap.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("Loading and preprocessing...")
    raw = load_dataset(a.dataset, only=[a.signal])
    windows = {pid: preprocess_participant(p, pid)["windows"].get(a.signal) for pid, p in raw.items()}
    windows = {k: v for k, v in windows.items() if v is not None}

    val_ids = [x.strip() for x in a.val.split(",")]
    test_ids = [x.strip() for x in a.test.split(",")]
    train_ids = [p for p in windows if p not in val_ids and p not in test_ids]

    Xtr, ytr = collect(windows, train_ids)
    Xva, yva = collect(windows, val_ids)
    Xte, yte = collect(windows, test_ids)
    Xtr, Xva = Xtr[ytr == 0], Xva[yva == 0]                      # calm windows only
    print(f"calm train windows: {len(Xtr)}, calm val windows: {len(Xva)}, test windows: {len(Xte)}")
    if len(Xtr) == 0 or len(Xva) == 0 or len(Xte) == 0:
        sys.exit("Not enough windows - check participant ids and dataset path.")

    model = ConvAutoencoder1D().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=a.lr)
    lossf = nn.MSELoss()
    Xt = torch.from_numpy(Xtr)
    best, best_state, bad = 1e9, None, 0
    for ep in range(1, a.epochs + 1):
        model.train()
        perm = torch.randperm(len(Xt))
        for i in range(0, len(Xt), a.batch_size):
            x = Xt[perm[i:i + a.batch_size]].to(device)
            if len(x) < 2:                                        # BatchNorm needs >1 sample
                continue
            opt.zero_grad()
            recon, _ = model(x)
            loss = lossf(recon, x.unsqueeze(1))
            loss.backward()
            opt.step()
        v = float(compute_reconstruction_errors(model, Xva, device).mean())
        print(f"  epoch {ep:3d}  calm val error {v:.4f}")
        if v < best - 1e-5:
            best, bad = v, 0
            best_state = {k: t.detach().clone() for k, t in model.state_dict().items()}
        else:
            bad += 1
            if bad >= a.patience:
                break
    model.load_state_dict(best_state)

    ev = compute_reconstruction_errors(model, Xva, device)
    thr = float(ev.mean() + 2 * ev.std())                         # same rule as the deck: mean + 2 std on calm val
    et = compute_reconstruction_errors(model, Xte, device)

    names = {0: "low", 1: "moderate", 2: "high"}
    per_class = {}
    for c, n in names.items():
        m = yte == c
        if m.any():
            per_class[n] = {"windows": int(m.sum()), "mean_error": float(et[m].mean()),
                            "flagged_fraction": float((et[m] > thr).mean())}
    auroc = None
    m = np.isin(yte, [0, 2])
    if m.any() and len(np.unique(yte[m])) == 2:
        auroc = float(roc_auc_score(yte[m] == 2, et[m]))          # 0.5 = no better than chance

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out / "autoencoder.pt")
    res = {"threshold": thr, "calm_val_error_mean": float(ev.mean()), "calm_val_error_std": float(ev.std()),
           "auroc_high_stress_vs_calm": auroc, "test_per_class": per_class,
           "train_calm_windows": int(len(Xtr)), "signal": a.signal,
           "note": "Trained on calm windows only. Flagged fraction on 'low' is the false-alarm rate."}
    json.dump(res, open(out / "autoencoder_metrics.json", "w"), indent=2)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()