"""
indicators.py - one honest report for the dashboard's 8 indicators.

Every indicator carries a `status` so the UI (and the judges) can see what is actually computed:
  "model"       learned from labelled data (stress / cognitive load classifier)
  "signal"      computed from the signal with a standard formula (HRV, respiration rate)
  "proxy"       a trend only - NOT a diagnosis, not validated
  "unavailable" needs a sensor or labels we do not have
No torch needed. numpy + scipy only.
"""
import numpy as np
from scipy import signal as sp


# ---------- signal-derived features ----------
def rmssd(ibi_ms):
    d = np.diff(np.asarray(ibi_ms, float))
    return float(np.sqrt(np.mean(d ** 2))) if len(d) else float("nan")


def sdnn(ibi_ms):
    a = np.asarray(ibi_ms, float)
    return float(np.std(a, ddof=1)) if len(a) > 1 else float("nan")


def resp_rate_from_ppg(raw_ppg, fs, band=(0.1, 0.5)):
    """Breaths/min from the slow respiratory component of RAW (not 0.5-8 Hz filtered) PPG."""
    x = np.asarray(raw_ppg, float)
    sos = sp.butter(3, band, btype="bandpass", fs=fs, output="sos")
    y = sp.sosfiltfilt(sos, x - x.mean())
    f, p = sp.welch(y, fs=fs, nperseg=min(len(y), int(fs * 60)))
    m = (f >= band[0]) & (f <= band[1])
    return float(f[m][p[m].argmax()] * 60.0)


def deviation(value, baseline_mean, baseline_std):
    """z-score vs the person's own calm baseline."""
    if baseline_std is None or baseline_std <= 0 or np.isnan(value):
        return None
    return float((value - baseline_mean) / baseline_std)


def _item(id_, label, status, value=None, unit=None, z=None, confidence=None, note=""):
    return {"id": id_, "label": label, "status": status, "value": value, "unit": unit,
            "deviation_from_baseline_z": z, "confidence": confidence, "note": note}


def build_report(probs=None, ibi_ms=None, raw_ppg=None, fs=None, baseline=None, cabin_co2_ppm=None):
    """
    probs:    (p_low, p_moderate, p_high) from the stress classifier, or None
    ibi_ms:   inter-beat intervals (ms) for the window, or None
    raw_ppg:  unfiltered PPG window + fs, or None
    baseline: {"rmssd": (mean, std), "resp_rate": (mean, std), "hr": (mean, std)} from calm calibration
    """
    baseline = baseline or {}
    out = []

    # 1 Acute stress  (model)
    if probs is not None:
        risk = float(probs[2] + 0.5 * probs[1])
        out.append(_item("acute_stress", "Acute stress detection", "model", round(risk * 100, 1), "risk 0-100",
                         confidence=round(float(max(probs)), 2),
                         note="Classifier trained on GalaxyPPG (+WESAD). Indicator, not a diagnosis."))
        out.append(_item("cognitive_overload", "Cognitive overload", "model", round(float(probs[1]) * 100, 1), "prob %",
                         confidence=round(float(max(probs)), 2),
                         note="Uses the 'moderate' class (prep/typing/reading). Weak in first tests."))
    else:
        out.append(_item("acute_stress", "Acute stress detection", "unavailable", note="no model output"))
        out.append(_item("cognitive_overload", "Cognitive overload", "unavailable", note="no model output"))

    # 2 Autonomic balance (signal)
    if ibi_ms is not None and len(ibi_ms) > 5:
        v = rmssd(ibi_ms)
        b = baseline.get("rmssd", (None, None))
        out.append(_item("ans_balance", "Autonomic nervous system balance", "signal", round(v, 1), "RMSSD ms",
                         z=deviation(v, *b) if b[0] is not None else None,
                         note="HRV (RMSSD). Lower than own baseline = lower parasympathetic activity."))
    else:
        out.append(_item("ans_balance", "Autonomic nervous system balance", "unavailable", note="needs inter-beat intervals"))

    # 3 Cardiovascular deconditioning (proxy)
    if ibi_ms is not None and len(ibi_ms) > 5:
        hr = float(60000.0 / np.mean(ibi_ms)); b = baseline.get("hr", (None, None))
        out.append(_item("cv_deconditioning", "Cardiovascular deconditioning", "proxy", round(hr, 1), "bpm",
                         z=deviation(hr, *b) if b[0] is not None else None,
                         note="Heart-rate trend vs own baseline only. Real deconditioning needs clinical tests."))
    else:
        out.append(_item("cv_deconditioning", "Cardiovascular deconditioning", "unavailable"))

    # 4 Fluid shift, 5 neuro fatigue, 6 mito/oxidative - no data to support them
    out.append(_item("fluid_shift", "Microgravity fluid shift", "unavailable",
                     note="Needs fluid/ultrasound/impedance data; none in our datasets."))
    out.append(_item("neuro_fatigue", "Neurological fatigue", "unavailable",
                     note="Needs cognitive-test or sleep labels; none in our datasets."))
    out.append(_item("mito_oxidative", "Mitochondrial and oxidative stress risk", "unavailable",
                     note="Blood/omics biomarkers (e.g. OSD-571/575) are single time-point reference data, not wearable-linked."))

    # 7 Respiration (signal) + cabin CO2 (external sensor)
    if raw_ppg is not None and fs:
        rr = resp_rate_from_ppg(raw_ppg, fs); b = baseline.get("resp_rate", (None, None))
        out.append(_item("respiration", "Respiratory rhythm", "signal", round(rr, 1), "breaths/min",
                         z=deviation(rr, *b) if b[0] is not None else None,
                         note="Estimated from PPG; validate against WESAD chest respiration."))
    else:
        out.append(_item("respiration", "Respiratory rhythm", "unavailable", note="needs raw PPG"))
    if cabin_co2_ppm is not None:
        out.append(_item("cabin_co2", "Cabin CO2 strain", "signal", float(cabin_co2_ppm), "ppm",
                         note="Raw reading from a cabin sensor; thresholds must come from official limits."))
    else:
        out.append(_item("cabin_co2", "Cabin CO2 strain", "unavailable", note="needs a cabin CO2 sensor input"))

    return {"indicators": out, "disclaimer": "Prototype decision support, not a medical device."}


if __name__ == "__main__":
    fs = 64; t = np.arange(fs * 120) / fs
    ppg = np.sin(2 * np.pi * 1.2 * t) + 0.6 * np.sin(2 * np.pi * 0.25 * t)       # 15 breaths/min
    ibi = 800 + 40 * np.sin(2 * np.pi * 0.25 * np.arange(120)) + np.random.randn(120) * 5
    r = build_report(probs=(0.2, 0.3, 0.5), ibi_ms=ibi, raw_ppg=ppg, fs=fs,
                     baseline={"rmssd": (60.0, 15.0), "resp_rate": (14.0, 2.0), "hr": (70.0, 5.0)})
    for i in r["indicators"]:
        print(f"{i['id']:20s} {i['status']:12s} {i['value']} {i['unit'] or ''}  z={i['deviation_from_baseline_z']}")
