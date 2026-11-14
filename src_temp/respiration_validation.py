"""
respiration_validation.py - checks the PPG-derived breathing rate against WESAD's chest respiration belt.

Usage (from the repo root):
    python final/src/respiration_validation.py --wesad WESAD
Writes final/artifacts/respiration_validation.json (+ .csv per window).
Reference = breathing rate from the chest Resp channel (700 Hz); estimate = from wrist BVP (64 Hz),
both with the same method (dominant frequency in 0.1-0.5 Hz), on 60 s windows, step 30 s.
"""
import argparse, csv, json, pickle, sys
from pathlib import Path
import numpy as np
from scipy import signal as sp

sys.path.insert(0, str(Path(__file__).resolve().parent))
from indicators import resp_rate_from_ppg

BVP_FS, RESP_FS, LABEL_FS = 64.0, 700.0, 700.0
WIN_S, STEP_S = 60, 30


def load_raw(pkl):
    with open(pkl, "rb") as f:
        d = pickle.load(f, encoding="latin1")
    bvp = np.asarray(d["signal"]["wrist"]["BVP"], float).ravel()
    chest = d["signal"]["chest"]
    key = next(k for k in chest if k.lower().startswith("resp"))
    resp = np.asarray(chest[key], float).ravel()
    lab = np.asarray(d["label"]).ravel().astype(int)
    return bvp, resp, lab


def run(wesad_dir):
    rows = []
    for sub in sorted(Path(wesad_dir).glob("S*")):
        pkl = sub / f"{sub.name}.pkl"
        if not pkl.exists():
            continue
        bvp, resp, lab = load_raw(pkl)
        resp70 = sp.decimate(resp, 10, zero_phase=True)          # 700 -> 70 Hz, plenty for <0.5 Hz
        total_s = min(len(bvp) / BVP_FS, len(resp) / RESP_FS)
        for t0 in np.arange(0, total_s - WIN_S, STEP_S):
            seg_lab = lab[int(t0 * LABEL_FS): int((t0 + WIN_S) * LABEL_FS)]
            if len(seg_lab) == 0 or np.mean(np.isin(seg_lab, [1, 2, 3, 4])) < 0.8:
                continue                                          # skip transient / ignored stretches
            est = resp_rate_from_ppg(bvp[int(t0 * BVP_FS): int((t0 + WIN_S) * BVP_FS)], BVP_FS)
            ref = resp_rate_from_ppg(resp70[int(t0 * 70): int((t0 + WIN_S) * 70)], 70.0)
            rows.append({"subject": sub.name, "t0_s": float(t0), "bvp_bpm": est, "ref_bpm": ref})
        print(f"  {sub.name}: {sum(r['subject'] == sub.name for r in rows)} windows")
    return rows


def summarize(rows):
    e = np.array([r["bvp_bpm"] for r in rows]); r_ = np.array([r["ref_bpm"] for r in rows])
    err = np.abs(e - r_)
    return {"n_windows": int(len(rows)),
            "mae_breaths_per_min": float(err.mean()),
            "within_3_bpm_fraction": float((err <= 3).mean()),
            "pearson_r": float(np.corrcoef(e, r_)[0, 1]) if len(rows) > 2 and e.std() > 0 and r_.std() > 0 else None}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--wesad", required=True)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "artifacts"))
    a = ap.parse_args()
    rows = run(a.wesad)
    if not rows:
        sys.exit("No windows found - check the WESAD path (expects WESAD/S2/S2.pkl ...)")
    s = summarize(rows); print(json.dumps(s, indent=2))
    Path(a.out).mkdir(parents=True, exist_ok=True)
    json.dump(s, open(Path(a.out) / "respiration_validation.json", "w"), indent=2)
    with open(Path(a.out) / "respiration_validation.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
