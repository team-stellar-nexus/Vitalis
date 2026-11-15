# Vitalis — backend integration

The dashboard (`/src`) now talks to the real FastAPI service in `backend/`
(`Vitalis-main.zip`, extracted). Demo mode is untouched; live mode shows results
returned by the trained classifier.

## Layout

```
/
├─ src/                 React dashboard (unchanged design)
├─ backend/             FastAPI service, trained checkpoints, signal processing
│  ├─ src/api.py        GET /health, POST /report
│  ├─ src/indicators.py indicator construction (model / signal / proxy / unavailable)
│  ├─ artifacts/         best_model.pt + best_encoder.pt + metrics.json
│  └─ .venv/             local Python environment (not committed)
├─ .env.example         VITE_API_BASE_URL
└─ BACKEND_INTEGRATION_GAPS.md
```

## 1. Run the backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# or: ./.venv/bin/pip install -r requirements.txt               # macOS / Linux

python -m uvicorn api:app --app-dir src --port 8000
```

Interactive docs: <http://localhost:8000/docs>

`/health` reports whether the checkpoint loaded:

```json
{"status":"ok","model":{"loaded":true,"num_classes":3,"path":"...best_model.pt","error":null}}
```

If torch or the checkpoint is missing, `/report` still answers: stress and
cognitive indicators come back `unavailable`, HRV/respiration still work.

## 2. Run the dashboard

```bash
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev              # http://localhost:5173
```

Switch **Demo | Live** in the top bar. The choice is per session.

## 3. What the frontend actually calls

| Call | Where | Purpose |
| --- | --- | --- |
| `GET /health` | `src/services/vitalisApi.ts` → `fetchHealth` | Availability + model loading state, every 10 s in live mode |
| `POST /report` | `src/services/vitalisApi.ts` → `postReport` | Real inference, every 15 s in live mode |

Request built in `src/state/VitalisBackendProvider.tsx`:

```json
{
  "ppg": [ /* last 30 s of the astronaut's samples, newest last */ ],
  "fs": 50,
  "ibi_ms": [ /* R-R intervals in ms from the same buffer */ ],
  "baseline": { "hr": [64, 6.4], "rmssd": [61, 9.15] },
  "cabin_co2_ppm": null
}
```

Response fields used: `indicators[]` (`id`, `label`, `status`, `value`, `unit`,
`deviation_from_baseline_z`, `confidence`, `note`), `probabilities`
(`low`/`moderate`/`high` or `null`), `notes`, `model`, `disclaimer`.

Nothing is added client-side: a `null` value stays `null`, an `unavailable`
status stays greyed out with the backend's own note.

## 4. Where it appears

- **Homepage, live mode** — `src/components/mission/ModelIndicators.tsx`
  replaces the simulated conclusions panel: classifier probabilities, every
  indicator with its status chip (MODEL / SIGNAL / PROXY / UNAVAILABLE), value,
  unit, confidence, deviation vs. the astronaut's baseline, backend notes and
  the medical-device disclaimer. Offline and "collecting the 30 s window" are
  explicit states, not fake results.
- **Live mode notice** — `LiveModeNotice` in `src/pages/Overview.tsx` states
  which values come from the backend and which are still local to the prototype.
- **Demo mode** — unchanged: the original simulated conclusion panel.

## 5. Per-astronaut data

Crew profiles live in `src/lib/crew.ts` (unchanged). Each profile owns its
sensor stream, baseline and its own report state. `VitalisBackendProvider` keeps
a separate sample buffer and report keyed by `profileId`, so switching astronauts
never reuses another astronaut's baseline or results. Profiles and their
histories are **frontend-managed demo data** — the backend has no profile store
yet (see gaps doc).

The last successful `/report` per astronaut is cached in `localStorage` under
`vitalis.vitalis-reports.v1` (at most 12 astronauts, entries older than
24 h are dropped), so a reload shows the previous model readout instead of an
empty panel and a fresh 30 s wait. Restored results are marked
**restored · previous session** and keep their original submission time, sample
count and probabilities; only the raw PPG window is not cached, because the
simulation clock restarts on reload. Clear the key (or DevTools → Application →
Local Storage) to start from scratch.

## 6. Signal observatory

Unchanged in design. The waveform renders the astronaut's own incoming samples;
the submitted window is the same array that `/report` receives. The spectrogram
and the fusion/witness panels are computed in the browser — the backend does not
return time-frequency data — and the live notice says so.

## 7. Known gaps

See `BACKEND_INTEGRATION_GAPS.md` for the API surface still missing (profiles,
baselines, signal/report history, websockets, fusion/witness endpoints,
spectrogram, reconstruction errors).
