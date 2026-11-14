"""
embeddings_tsne.py - t-SNE plot of the encoder's 128-number embeddings + class-centroid cosine similarity.
(LIGO/GravitySpy-style "feature space" view: do the classes separate?)

Usage (from the repo root):
    python final/src/embeddings_tsne.py --dataset Dataset --pids P07,P14,P21,P10,P17,P24
Needs a trained checkpoint in final/artifacts/best_model.pt. Writes final/artifacts/tsne.png.
"""
import argparse, sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
ART = Path(__file__).resolve().parent.parent / "artifacts"


def plot_tsne(emb, labels, path, class_names):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.manifold import TSNE
    from sklearn.metrics.pairwise import cosine_similarity
    emb, labels = np.asarray(emb, float), np.asarray(labels, int)
    xy = TSNE(n_components=2, perplexity=max(2, min(30, (len(emb) - 1) // 3)), init="pca", random_state=0).fit_transform(emb)
    fig, ax = plt.subplots(figsize=(6, 5))
    for c, name in enumerate(class_names):
        m = labels == c
        if m.any():
            ax.scatter(xy[m, 0], xy[m, 1], s=8, alpha=0.7, label=f"{name} (n={int(m.sum())})")
    ax.set_title("Encoder embeddings (t-SNE)"); ax.legend(); fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)
    cents = np.stack([emb[labels == c].mean(0) for c in range(len(class_names)) if (labels == c).any()])
    return cosine_similarity(cents)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", default="Dataset")
    ap.add_argument("--signal", default="E4_BVP")
    ap.add_argument("--pids", default="P07,P14,P21,P10,P17,P24")
    ap.add_argument("--checkpoint", default=str(ART / "best_model.pt"))
    ap.add_argument("--out", default=str(ART / "tsne.png"))
    a = ap.parse_args()

    import torch
    from data.loader import load_dataset
    from data.preprocessor import preprocess_participant
    from models.encoder import HealthClassifier

    state = torch.load(a.checkpoint, map_location="cpu", weights_only=True)
    n = int(state["classifier.4.weight"].shape[0])
    model = HealthClassifier(num_classes=n); model.load_state_dict(state); model.eval()
    names = ["not stress", "stress"] if n == 2 else ["low", "moderate", "high"]

    raw = load_dataset(a.dataset, only=[a.signal])
    E, Y = [], []
    for pid in a.pids.split(","):
        w, l = preprocess_participant(raw[pid.strip()], pid)["windows"][a.signal]
        if n == 2:
            l = (l == 2).astype(np.int64)
        if len(w):
            with torch.no_grad():
                E.append(model(torch.from_numpy(w))[1].numpy()); Y.append(l)
    emb, lab = np.concatenate(E), np.concatenate(Y)
    sim = plot_tsne(emb, lab, a.out, names)
    print("saved", a.out); print("class-centroid cosine similarity:\n", np.round(sim, 3))
