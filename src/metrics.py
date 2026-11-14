"""metrics.py - numpy-only evaluation helpers (no torch)."""
import numpy as np


def confusion_matrix(y_true, y_pred, n_classes):
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(np.asarray(y_true, int), np.asarray(y_pred, int)):
        if 0 <= t < n_classes and 0 <= p < n_classes:
            cm[t, p] += 1
    return cm


def per_class_recall(cm):
    support = cm.sum(axis=1)
    return [float(cm[i, i] / support[i]) if support[i] else None for i in range(len(cm))]


def balanced_accuracy(y_true, y_pred, n_classes):
    """Mean recall over the classes that actually occur - not fooled by a dominant class."""
    r = [x for x in per_class_recall(confusion_matrix(y_true, y_pred, n_classes)) if x is not None]
    return float(np.mean(r)) if r else 0.0


def macro_f1(cm):
    f = []
    for i in range(len(cm)):
        tp = cm[i, i]; fp = cm[:, i].sum() - tp; fn = cm[i, :].sum() - tp
        if cm[i, :].sum() == 0:
            continue
        f.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return float(np.mean(f)) if f else 0.0


def summarize(y_true, y_pred, n_classes):
    y_true, y_pred = np.asarray(y_true, int), np.asarray(y_pred, int)
    cm = confusion_matrix(y_true, y_pred, n_classes)
    n = int(cm.sum())
    return {"n_windows": n,
            "accuracy": float(np.trace(cm) / n) if n else 0.0,
            "balanced_accuracy": balanced_accuracy(y_true, y_pred, n_classes),
            "macro_f1": macro_f1(cm),
            "per_class_recall": per_class_recall(cm),
            "support": cm.sum(axis=1).tolist(),
            "majority_class_baseline": float(cm.sum(axis=1).max() / n) if n else 0.0,
            "chance_balanced_accuracy": float(1.0 / max(1, int((cm.sum(axis=1) > 0).sum()))),
            "confusion_matrix": cm.tolist()}
