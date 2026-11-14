"""
api.py - FastAPI backend for the dashboard.
Put this file and indicators.py in src/ (next to train.py, data/, models/).
Run from the repo root:   python -m uvicorn api:app --app-dir src --port 8000
Docs page (try it in the browser):  http://localhost:8000/docs

It works without a trained model too: the stress/cognitive indicators then come back as
"unavailable" while HRV and respiration (signal-derived) still work.
"""
import math
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data.preprocessor import (apply_butterworth_bandpass, resample_to_uniform_grid, z_score_normalize,
                               TARGET_SAMPLING_RATE, SAMPLES_PER_WINDOW)
from indicators import build_report

CHECKPOINT = os.environ.get("MODEL_PATH", str(Path(__file__).resolve().parent.parent / "artifacts" / "best_model.pt"))

app = FastAPI(title="Astronaut Health API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])  # tighten for production

_model = None
_model_info = {"loaded": False, "path": CHECKPOINT, "num_classes": None, "error": None}


def load_model():
    """Load the checkpoint once (restart the server after training a new one)."""
    global _model
    if _model is not None or _model_info["error"]:
        return _model
    try:
        import torch
        from models.encoder import HealthClassifier
        state = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
        n = int(state["classifier.4.weight"].shape[0])       # 3 classes, or 2 if trained with --binary
        m = HealthClassifier(num_classes=n)
        m.load_state_dict(state)
        m.eval()
        _model = m
        _model_info.update(loaded=True, num_classes=n)
    except Exception as e:                                   # no torch, no checkpoint, wrong shape...
        _model_info["error"] = f"{type(e).__name__}: {e}"
    return _model


def to_model_window(raw_ppg, fs: float):
    """Raw PPG -> the 750-sample window the model expects (last 30 s), or None if too short.
    NOTE: training z-scored whole recordings; here we z-score the 30 s window. Retrain with per-window
    normalisation (or keep running stats) before trusting live numbers."""
    raw = np.asarray(raw_ppg, float)
    filt = apply_butterworth_bandpass(raw, fs=fs, lowcut=0.5, highcut=min(8.0, 0.45 * fs))
    sig = resample_to_uniform_grid(filt, np.arange(len(filt)) / fs, TARGET_SAMPLING_RATE)
    if len(sig) < SAMPLES_PER_WINDOW - 2:
        return None
    if len(sig) < SAMPLES_PER_WINDOW:                        # exactly 30 s resamples to 749 samples
        sig = np.pad(sig, (SAMPLES_PER_WINDOW - len(sig), 0), mode="edge")
    return z_score_normalize(sig[-SAMPLES_PER_WINDOW:]).astype(np.float32)


def predict_probs(window) -> Optional[Tuple[float, float, float]]:
    """(p_low, p_moderate, p_high), or None if no model is available."""
    m = load_model()
    if m is None or window is None:
        return None
    import torch
    with torch.no_grad():
        logits, _ = m(torch.from_numpy(window).unsqueeze(0))
        p = torch.softmax(logits, dim=1)[0].numpy()
    if len(p) == 2:                                          # binary model: (not stress, stress)
        return (float(p[0]), 0.0, float(p[1]))
    return tuple(float(x) for x in p)


def _clean(o):
    """NaN/inf are not valid JSON -> None."""
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


class ReportRequest(BaseModel):
    ppg: List[float] = Field(..., description="Raw PPG/BVP samples, newest last. Send at least 30 s.")
    fs: float = Field(64.0, gt=0, description="Sampling rate of `ppg` in Hz (E4 BVP = 64)")
    ibi_ms: Optional[List[float]] = Field(None, description="Inter-beat intervals in ms for the same period")
    baseline: Optional[Dict[str, Tuple[float, float]]] = Field(
        None, description='Calm baseline as {"rmssd": [mean, std], "resp_rate": [...], "hr": [...]}')
    cabin_co2_ppm: Optional[float] = None


@app.get("/health")
def health():
    load_model()
    return {"status": "ok", "model": _model_info}


@app.post("/report")
def report(req: ReportRequest):
    if len(req.ppg) < int(req.fs * 10):
        raise HTTPException(status_code=422, detail="Send at least 10 s of PPG (30 s for the stress model).")
    notes = []
    window = to_model_window(req.ppg, req.fs)
    if window is None:
        notes.append("Fewer than 30 s of data: stress and cognitive indicators need a full 30 s window.")
    probs = predict_probs(window)
    if window is not None and probs is None:
        notes.append("No trained model loaded: stress and cognitive indicators unavailable.")

    raw_last_60s = req.ppg[-int(req.fs * 60):]               # respiration needs the slow component
    rep = build_report(probs=probs, ibi_ms=req.ibi_ms, raw_ppg=raw_last_60s, fs=req.fs,
                       baseline=req.baseline, cabin_co2_ppm=req.cabin_co2_ppm)
    rep["probabilities"] = None if probs is None else {"low": probs[0], "moderate": probs[1], "high": probs[2]}
    rep["notes"] = notes
    rep["model"] = _model_info
    return _clean(rep)
