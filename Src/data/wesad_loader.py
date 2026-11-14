"""
wesad_loader.py - turns WESAD (Schmidt et al., ICMI 2018) wrist BVP into the same window format
as data/preprocessor.py, so build_datasets() can mix it with GalaxyPPG participants.

Expected layout (the dataset's synchronised pickles):
    WESAD/S2/S2.pkl, WESAD/S3/S3.pkl, ...      (S1 and S12 are not usable)
Each pickle: d["signal"]["wrist"]["BVP"] (64 Hz), d["label"] (700 Hz).
Label codes: 0 transient, 1 baseline, 2 stress, 3 amusement, 4 meditation, 5-7 ignore.

License: scientific, non-commercial use with credit to the owners. Cite:
Schmidt et al., "Introducing WESAD, a multimodal dataset for wearable stress and affect detection", ICMI 2018.
"""
import pickle
from pathlib import Path
import numpy as np

from data.preprocessor import (apply_butterworth_bandpass, resample_to_uniform_grid, z_score_normalize,
                               TARGET_SAMPLING_RATE, SAMPLES_PER_WINDOW, WINDOW_OVERLAP_RATIO, PER_WINDOW_NORM)

BVP_FS = 64.0
LABEL_FS = 700.0
MIN_PURITY = 0.8          # a window needs >= 80% of one label, otherwise it is dropped

# WESAD label code -> our class (0 = not stressed, 2 = stress). Amusement is treated as not stressed.
LABEL_MAP = {1: 0, 4: 0, 3: 0, 2: 2}


def load_subject(pkl_path):
    with open(pkl_path, "rb") as f:
        d = pickle.load(f, encoding="latin1")
    bvp = np.asarray(d["signal"]["wrist"]["BVP"], dtype=float).ravel()
    lab = np.asarray(d["label"]).ravel().astype(int)
    return bvp, lab


def window_subject(bvp, lab, label_map=LABEL_MAP):
    filt = apply_butterworth_bandpass(bvp, fs=BVP_FS, lowcut=0.5, highcut=8.0)
    t = np.arange(len(filt)) / BVP_FS
    sig = z_score_normalize(resample_to_uniform_grid(filt, t, TARGET_SAMPLING_RATE))

    n, step = SAMPLES_PER_WINDOW, int(SAMPLES_PER_WINDOW * (1 - WINDOW_OVERLAP_RATIO))
    wins, labs = [], []
    for s in range(0, len(sig) - n + 1, step):
        t0, t1 = s / TARGET_SAMPLING_RATE, (s + n) / TARGET_SAMPLING_RATE
        seg = lab[int(t0 * LABEL_FS): int(t1 * LABEL_FS)]
        if len(seg) == 0:
            continue
        codes, counts = np.unique(seg, return_counts=True)
        top = codes[counts.argmax()]
        if top not in label_map or counts.max() / len(seg) < MIN_PURITY:
            continue                               # transient / ignored / mixed window
        seg_w = sig[s:s + n]
        wins.append(z_score_normalize(seg_w) if PER_WINDOW_NORM else seg_w); labs.append(label_map[top])
    if not wins:
        return np.empty((0, n), np.float32), np.empty((0,), np.int64)
    return np.asarray(wins, np.float32), np.asarray(labs, np.int64)


def load_wesad(wesad_dir, signal_key="E4_BVP"):
    """-> {"WESAD_S2": {"participant": ..., "windows": {signal_key: (wins, labs)}}, ...}"""
    out = {}
    for sub in sorted(Path(wesad_dir).glob("S*")):
        pkl = sub / f"{sub.name}.pkl"
        if not pkl.exists():
            continue
        print(f"  Loading WESAD {sub.name}")
        bvp, lab = load_subject(pkl)
        out[f"WESAD_{sub.name}"] = {"participant": f"WESAD_{sub.name}",
                                    "windows": {signal_key: window_subject(bvp, lab)}}
    return out
