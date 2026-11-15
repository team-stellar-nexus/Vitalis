import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BackendBaseline, ReportPayload, VitalisHealth, VitalisReport } from '@/services/vitalisApi';
import {
  fetchHealth,
  postReport,
  VITALIS_API_BASE_URL,
  VitalisApiError,
} from '@/services/vitalisApi';
import { useTelemetry } from '@/state/TelemetryProvider';

/** The local signal generator runs at this rate (see src/simulation/engine.ts). */
export const SIGNAL_SAMPLE_RATE_HZ = 50;
/** The trained stress classifier needs a 30 s window. */
export const MODEL_WINDOW_SECONDS = 30;
/** Backend guidance: call /report about every 15 s with the latest 30–60 s of PPG. */
export const REPORT_INTERVAL_MS = 15000;
export const HEALTH_INTERVAL_MS = 10000;

const STORAGE_KEY = 'vitalis.vitalis-reports.v1';
/** Older results are not restored: the mission window they describe is gone. */
const MAX_STORED_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_PROFILES = 12;

export type BackendState = 'idle' | 'connecting' | 'online' | 'offline';

export interface ProfileReportState {
  report: VitalisReport | null;
  error: string | null;
  pending: boolean;
  submittedAt: number | null;
  sampleCount: number;
  spanSeconds: number;
  /** True when the report was read back from storage rather than received this session. */
  restored: boolean;
}

interface BufferEntry {
  points: Array<{ t: number; v: number }>;
}

interface VitalisBackendContextValue {
  backendUrl: string;
  state: BackendState;
  health: VitalisHealth | null;
  healthError: string | null;
  /** Report state for the active astronaut only. */
  active: ProfileReportState;
  reports: Record<string, ProfileReportState>;
  submitNow: () => void;
  refreshHealth: () => void;
  /** Seconds of PPG accumulated so far for the active astronaut. */
  bufferedSeconds: number;
}

const EMPTY_STATE: ProfileReportState = {
  report: null,
  error: null,
  pending: false,
  submittedAt: null,
  sampleCount: 0,
  spanSeconds: 0,
  restored: false,
};

interface StoredReport {
  report: VitalisReport;
  submittedAt: number;
  sampleCount: number;
  spanSeconds: number;
}

/**
 * Reports are cached per astronaut so a reload does not blank the model readout.
 * Only the backend response and its provenance are stored: the PPG window is not,
 * because the simulation clock restarts on reload and the old sample timestamps
 * would not line up with a fresh buffer.
 */
function loadStoredReports(): Record<string, ProfileReportState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredReport | undefined>;
    const now = Date.now();
    const restored: Record<string, ProfileReportState> = {};
    for (const [profileId, entry] of Object.entries(parsed)) {
      if (!entry?.report || typeof entry.submittedAt !== 'number') continue;
      if (now - entry.submittedAt > MAX_STORED_AGE_MS) continue;
      restored[profileId] = {
        report: entry.report,
        error: null,
        pending: false,
        submittedAt: entry.submittedAt,
        sampleCount: entry.sampleCount ?? 0,
        spanSeconds: entry.spanSeconds ?? 0,
        restored: true,
      };
    }
    return restored;
  } catch {
    return {};
  }
}

function persistReports(reports: Record<string, ProfileReportState>) {
  if (typeof localStorage === 'undefined') return;
  try {
    const now = Date.now();
    const stored = Object.entries(reports)
      .filter(
        ([, value]) =>
          value.report && typeof value.submittedAt === 'number' && now - value.submittedAt <= MAX_STORED_AGE_MS,
      )
      .sort((a, b) => (b[1].submittedAt ?? 0) - (a[1].submittedAt ?? 0))
      .slice(0, MAX_STORED_PROFILES);
    if (!stored.length) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: Record<string, StoredReport> = {};
    for (const [profileId, value] of stored) {
      payload[profileId] = {
        report: value.report as VitalisReport,
        submittedAt: value.submittedAt as number,
        sampleCount: value.sampleCount,
        spanSeconds: value.spanSeconds,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage is optional (quota, private mode); the dashboard still works.
  }
}

const VitalisBackendContext = createContext<VitalisBackendContextValue | null>(null);

/**
 * Builds the `/report` payload from the astronaut's own buffered PPG.
 *
 * The signal itself comes from the local sensor generator: no PPG device is
 * connected in this prototype. The backend still performs real inference on
 * those samples, which is why the UI labels the signal source separately from
 * the model result.
 */
function buildPayload(
  points: Array<{ t: number; v: number }>,
  rrIntervals: number[],
  baseline: { hr: number; hrv: number },
): ReportPayload | null {
  if (!points.length) return null;
  const last = points[points.length - 1].t;
  const window = points.filter((point) => point.t >= last - MODEL_WINDOW_SECONDS);
  if (window.length < SIGNAL_SAMPLE_RATE_HZ * MODEL_WINDOW_SECONDS) return null;

  const backendBaseline: BackendBaseline = {
    // Spreads are demo-derived: the profile stores a calm mean per astronaut,
    // not per-astronaut standard deviations. Recorded in BACKEND_INTEGRATION_GAPS.md.
    hr: [baseline.hr, Math.max(1, Number((baseline.hr * 0.1).toFixed(2)))],
    rmssd: [baseline.hrv, Math.max(1, Number((baseline.hrv * 0.15).toFixed(2)))],
  };

  return {
    ppg: window.map((point) => point.v),
    fs: SIGNAL_SAMPLE_RATE_HZ,
    ibi_ms: rrIntervals.length > 2 ? rrIntervals.map((value) => Math.round(value * 100) / 100) : null,
    baseline: backendBaseline,
    cabin_co2_ppm: null,
  };
}

export function VitalisBackendProvider({ children }: { children: React.ReactNode }) {
  const { mode, snapshot, activeProfile } = useTelemetry();

  const [state, setState] = useState<BackendState>('idle');
  const [health, setHealth] = useState<VitalisHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ProfileReportState>>(() => loadStoredReports());

  const buffers = useRef<Record<string, BufferEntry>>({});
  const inFlight = useRef<Set<string>>(new Set());
  const latest = useRef({ snapshot, activeProfile });
  latest.current = { snapshot, activeProfile };

  // ---------------------------------------------------------------- buffering
  useEffect(() => {
    if (mode !== 'live') return;
    const key = activeProfile.profileId;
    const store = (buffers.current[key] ??= { points: [] });
    const cutoff = snapshot.simTime - 90;
    const merged = new Map<number, number>();
    for (const point of store.points) if (point.t >= cutoff) merged.set(point.t, point.v);
    for (const point of snapshot.signal.ppg) {
      // `signal.ppg` carries second offsets from the current simulation time.
      const absolute = Math.round((snapshot.simTime + point.t) * 100) / 100;
      merged.set(absolute, point.v);
    }
    store.points = [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));
  }, [mode, activeProfile.profileId, snapshot.simTime, snapshot.signal.ppg]);

  // ------------------------------------------------------------------ health
  const checkHealth = useCallback(async () => {
    // A periodic health poll must not flash "connecting" over a healthy link.
    setState((prev) => (prev === 'online' ? prev : 'connecting'));
    try {
      const result = await fetchHealth();
      setHealth(result);
      setHealthError(result.model?.error ?? null);
      setState('online');
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : String(error));
      setState('offline');
    }
  }, []);

  useEffect(() => {
    if (mode !== 'live') {
      setState('idle');
      return;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) void checkHealth();
    };
    run();
    const timer = setInterval(run, HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, checkHealth]);

  // ------------------------------------------------------------------ reports
  const submit = useCallback(async () => {
    const { snapshot: snap, activeProfile: profile } = latest.current;
    const key = profile.profileId;
    if (inFlight.current.has(key)) return;

    const store = buffers.current[key];
    const payload = store
      ? buildPayload(store.points, snap.signal.rrIntervals, profile.baseline)
      : null;

    if (!payload) {
      setReports((prev) => {
        const existing = prev[key] ?? EMPTY_STATE;
        // A report restored from storage keeps its own provenance: the fresh
        // buffer must not relabel it with a sample count it never sent.
        if (existing.report) return prev;
        return {
          ...prev,
          [key]: {
            ...existing,
            spanSeconds: store?.points.length
              ? Math.round(store.points[store.points.length - 1].t - store.points[0].t)
              : 0,
            sampleCount: store?.points.length ?? 0,
          },
        };
      });
      return;
    }

    inFlight.current.add(key);
    setReports((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? EMPTY_STATE),
        pending: true,
        error: null,
        sampleCount: payload.ppg.length,
        spanSeconds: MODEL_WINDOW_SECONDS,
      },
    }));

    try {
      const report = await postReport(payload);
      setState('online');
      setReports((prev) => ({
        ...prev,
        [key]: {
          report,
          error: null,
          pending: false,
          submittedAt: Date.now(),
          sampleCount: payload.ppg.length,
          spanSeconds: MODEL_WINDOW_SECONDS,
          restored: false,
        },
      }));
      setHealth((prev) => prev ?? { status: 'ok', model: report.model });
    } catch (error) {
      const message =
        error instanceof VitalisApiError
          ? [error.message, error.detail].filter(Boolean).join(' — ')
          : error instanceof Error
            ? error.message
            : String(error);
      setReports((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? EMPTY_STATE), pending: false, error: message },
      }));
      if (error instanceof VitalisApiError && (error.status === undefined || error.status >= 500)) {
        setState('offline');
      }
    } finally {
      inFlight.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'live') return;
    // Give the first window half a second of buffer before the first call.
    const first = setTimeout(() => void submit(), 1200);
    const timer = setInterval(() => void submit(), REPORT_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [mode, submit]);

  // Cache the latest report per astronaut so a reload keeps the model readout.
  useEffect(() => {
    persistReports(reports);
  }, [reports]);

  const value = useMemo<VitalisBackendContextValue>(() => {
    const active = reports[activeProfile.profileId] ?? {
      ...EMPTY_STATE,
      sampleCount: buffers.current[activeProfile.profileId]?.points.length ?? 0,
    };
    return {
      backendUrl: VITALIS_API_BASE_URL,
      state,
      health,
      healthError,
      active,
      reports,
      submitNow: () => void submit(),
      refreshHealth: () => void checkHealth(),
      bufferedSeconds: active.spanSeconds,
    };
  }, [reports, activeProfile.profileId, state, health, healthError, submit, checkHealth]);

  return <VitalisBackendContext.Provider value={value}>{children}</VitalisBackendContext.Provider>;
}

export function useVitalisBackend() {
  const ctx = useContext(VitalisBackendContext);
  if (!ctx) throw new Error('useVitalisBackend must be used inside VitalisBackendProvider');
  return ctx;
}
