# BACKEND_INTEGRATION_GAPS

What the dashboard needs from the Vitalis backend that `/health` + `/report` do
not yet provide. Each item lists the current workaround and the exact addition
required. Nothing here is faked in the UI: where a capability is missing, the
dashboard either computes it locally (and labels it) or shows it as unavailable.

Verified against `backend/src/api.py` and `backend/src/indicators.py`.

---

## 1. Persistent astronaut profiles

**Missing.** The backend has no profile entity; `/report` is stateless and knows
nothing about the caller.

*Current:* `src/lib/crew.ts` holds three demo astronauts in the browser. They are
labelled demo/local everywhere they appear. Profiles are not persisted anywhere.

**Needed**
```
GET  /astronauts                 -> [{ id, mission_id, name, callsign, role, mission }]
POST /astronauts                 -> create
GET  /astronauts/{id}            -> profile
```
plus `astronaut_id` accepted on `/report` so results can be attributed server-side.

## 2. Per-astronaut baseline storage

**Missing.** `/report` accepts `baseline: {rmssd:[mean,std], resp_rate:[mean,std], hr:[mean,std]}`,
but nothing stores it; the client sends it on every request.

*Current:* the frontend sends the astronaut's calm means from `AstronautProfile.baseline`.
Those profiles store a **mean only** — no per-astronaut standard deviation — so the
client sends `hr` std = 10 % of mean and `rmssd` std = 15 % of mean. **These spreads are
demo-derived, not measured**, and the deviation z-scores inherit that limitation.

**Needed**
```
PUT  /astronauts/{id}/baseline   { rmssd:[mean,std], resp_rate:[mean,std], hr:[mean,std], windows, days }
GET  /astronauts/{id}/baseline
```
The backend should compute and persist the spread from the calibration period so the
client never has to invent it.

## 3. Historical signal retrieval

**Missing.** `/report` consumes PPG but does not retain it.

*Current:* `VitalisBackendProvider` keeps a rolling 90 s buffer per astronaut in
memory (React state), and submits the last 30 s. Refreshing the page loses it.

**Needed**
```
POST /signals/{astronaut_id}                     (raw PPG append, fs, timestamp)
GET  /signals/{astronaut_id}?window=30&from=...  (raw + filtered samples)
```

## 4. Historical report retrieval

**Missing.** Each `/report` result is returned once and discarded.

*Current:* the latest report per astronaut is kept in frontend memory only.

**Needed**
```
GET /reports/{astronaut_id}?limit=50   -> [{ id, created_at, indicators, probabilities, model }]
GET /reports/{report_id}
```

## 5. Real-time telemetry

**Missing.** No WebSocket or SSE endpoint.

*Current:* the dashboard runs on the local simulation engine at 1 Hz and posts the
resulting buffer to `/report`. `src/services/contracts.ts` still documents the
proposed `/ws/telemetry` contract.

**Needed:** `WS /ws/telemetry/{astronaut_id}` emitting `{type: "snapshot"|"anomaly"|"event", payload}`,
plus `astronaut_id` scoping.

## 6. Multi-window anomaly fusion

**Exists but not connected.** `backend/src/fusion.py` implements
`MultiWindowAnomalyDetector`, but `api.py` never imports it and `/report` returns no
window fusion. Thresholds in `fusion.py` are constructor arguments with placeholder
defaults (`30s:0.1, 60s:0.12, 120s:0.15, 240s:0.18`); nothing calibrates them.

*Current:* the dashboard renders its own 30/60/120/240 s fusion and labels the panel
as browser-computed. It is **not** backend output and does not drive any conclusion
in live mode.

**Needed:** `POST /fusion` (or a `fusion` block inside `/report`) returning
`{status, active_windows, risk_score, window_details}` from calibrated thresholds.

## 7. Witness-channel validation

**Exists but not connected.** `fusion.py::WitnessChannelValidator` needs per-channel
embedding vectors and a 0.65 cosine threshold. The API never produces embeddings, and
`best_encoder.pt` is not exposed.

*Current:* witness chips in the UI are derived from the simulation engine.

**Needed:** `POST /witness` taking `{primary_channel, embeddings}` or a server-side
endpoint that returns `{witness_channels, similarities, confirmed}` for the astronaut.

## 8. Spectrogram / time-frequency data

**Missing.** There is no Q-transform or STFT endpoint.

*Current:* `src/simulation/signal.ts::buildSpectrogram` synthesises the image in the
browser from the local stream. It is labelled "synthetic arrays", and in live mode the
page states the spectrogram is computed locally.

**Needed:** `GET /signals/{astronaut_id}/spectrogram?window=120&freq=0.5-8` returning
a power matrix + axes, so the plot shows real time-frequency content.

## 9. Reconstruction errors and thresholds

**Missing from the API.** `artifacts/best_encoder.pt` exists and
`src/models/autoencoder.py` defines an autoencoder, but `/report` returns only
classifier output — no reconstruction error, no per-window threshold.

*Current:* window error/threshold values on the dashboard come from the simulation
engine. They are **not** model errors and must not be read as such.

**Needed:** a `/reconstruct` (or `/report` extension) returning
`{error, threshold, flagged}` per window, with thresholds calibrated per astronaut
(e.g. mean + 2σ of the personal baseline).

## 10. Smaller additions the UI would use

- `model.metrics` from `artifacts/metrics.json` inside `/health` (accuracy,
  balanced accuracy, macro F1, per-class recall) so the dashboard can show the real
  performance instead of a static claim.
- `cabin_co2_ppm` currently has to be sent `null`; a cabin-sensor feed is required
  before that indicator can ever be other than `unavailable`.
- Rate limiting / request-size guard on `/report` before any multi-user deployment.

---

## Deliberately not implemented client-side

- No fabricated confidence for `signal` / `proxy` indicators: the backend returns
  `confidence: null` for them and the UI prints `—`.
- No invented values for `fluid_shift`, `neuro_fatigue`, `mito_oxidative`,
  `cabin_co2`: they arrive `unavailable` and render greyed out with the backend note.
- No claim that profiles or history are persisted: they are in-memory demo data.
