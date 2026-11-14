# API contract (backend <-> dashboard)

Start the backend from the repo root:
```
python -m uvicorn api:app --app-dir final/src --port 8000
```
Interactive docs: http://localhost:8000/docs

## GET /health
`{"status": "ok", "model": {"loaded": true, "num_classes": 3, "path": "...", "error": null}}`

## POST /report
Request:
```json
{
  "ppg": [0.01, 0.02, "... raw PPG/BVP samples, newest last, at least 30 s ..."],
  "fs": 64,
  "ibi_ms": [812, 790, 805],
  "baseline": {"rmssd": [60, 15], "resp_rate": [14, 2], "hr": [70, 5]},
  "cabin_co2_ppm": null
}
```
Only `ppg` is required (at least 10 s; 30 s+ for the stress model). `fs` defaults to 64 (Empatica E4 BVP).

Response:
```json
{
  "indicators": [
    {"id": "acute_stress", "label": "Acute stress detection", "status": "model",
     "value": 65.0, "unit": "risk 0-100", "deviation_from_baseline_z": null, "confidence": 0.5, "note": "..."},
    {"id": "respiration", "label": "Respiratory rhythm", "status": "signal",
     "value": 15.0, "unit": "breaths/min", "deviation_from_baseline_z": 0.5, "confidence": null, "note": "..."},
    {"id": "fluid_shift", "label": "Microgravity fluid shift", "status": "unavailable",
     "value": null, "note": "Needs fluid/ultrasound/impedance data; none in our datasets."}
  ],
  "probabilities": {"low": 0.2, "moderate": 0.3, "high": 0.5},
  "notes": [],
  "model": {"loaded": true},
  "disclaimer": "Prototype decision support, not a medical device."
}
```
Indicator ids: `acute_stress`, `cognitive_overload`, `ans_balance`, `cv_deconditioning`, `fluid_shift`,
`neuro_fatigue`, `mito_oxidative`, `respiration`, `cabin_co2`.

`status` is one of:
- `model`: learned from labelled data
- `signal`: computed with a standard formula (HRV, respiration rate)
- `proxy`: a trend only, not a diagnosis
- `unavailable`: needs a sensor or labels we do not have. **The UI should grey these out and show `note`.**

When no trained model is loaded, `acute_stress` and `cognitive_overload` are `unavailable` and everything else still works.
Call `/report` about every 15 s with the latest 30-60 s of PPG. Always show `disclaimer`.

## What the frontend teammate pushes
`final/frontend/` with: code, own dependency file, README (run + deploy), `.env.example`, a mock response JSON, screenshots.
Work on a `frontend` branch, run `git pull --rebase` before pushing, never commit `node_modules/` or `.env`.
