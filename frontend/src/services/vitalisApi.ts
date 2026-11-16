/**
 * Vitalis FastAPI client.
 *
 * This is the real backend contract (see `backend/src/api.py`), not the
 * proposed `/api/*` surface in `src/services/contracts.ts`:
 *
 *   GET  /health  -> { status, model: { loaded, num_classes, path, error } }
 *   POST /report  -> { indicators, probabilities, notes, model, disclaimer }
 *
 * Everything here is a thin transport. No values are invented: if the backend
 * does not return a field, the field stays null and the UI says so.
 */

export type IndicatorStatus = 'model' | 'signal' | 'proxy' | 'unavailable';

export interface VitalisIndicator {
  id: string;
  label: string;
  status: IndicatorStatus;
  value: number | null;
  unit: string | null;
  deviation_from_baseline_z: number | null;
  confidence: number | null;
  note: string;
}

export interface VitalisModelInfo {
  loaded: boolean;
  path?: string;
  num_classes?: number | null;
  error?: string | null;
}

export interface VitalisProbabilities {
  low: number;
  moderate: number;
  high: number;
}

export interface VitalisReport {
  indicators: VitalisIndicator[];
  /** null when the trained classifier is not available (backend returns null). */
  probabilities: VitalisProbabilities | null;
  notes: string[];
  model: VitalisModelInfo;
  disclaimer: string;
}

export interface VitalisHealth {
  status: string;
  model: VitalisModelInfo;
}

/** Baseline shape the backend expects: metric -> [mean, std]. */
export type BackendBaseline = Record<string, [number, number]>;

export interface ReportPayload {
  /** Raw PPG/BVP samples, newest last. */
  ppg: number[];
  fs: number;
  ibi_ms?: number[] | null;
  baseline?: BackendBaseline | null;
  cabin_co2_ppm?: number | null;
}

const DEFAULT_BASE_URL = 'https://vitalis-api-yjc1.onrender.com';

export const VITALIS_API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL
).replace(/\/+$/, '');

export class VitalisApiError extends Error {
  status?: number;
  detail?: string;
  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = 'VitalisApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${VITALIS_API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { detail?: unknown };
        if (typeof parsed.detail === 'string') detail = parsed.detail;
      } catch {
        // Non-JSON error body; keep the raw text.
      }
      throw new VitalisApiError(
        `Backend responded ${res.status} for ${path}`,
        res.status,
        detail.slice(0, 320),
      );
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof VitalisApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new VitalisApiError(`Request to ${path} timed out after ${timeoutMs / 1000}s.`);
    }
    throw new VitalisApiError(
      `Unable to reach the Vitalis backend at ${VITALIS_API_BASE_URL}. Start it with: python -m uvicorn api:app --app-dir src --port 8000`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function fetchHealth(timeoutMs = 5000): Promise<VitalisHealth> {
  return request<VitalisHealth>('/health', { method: 'GET' }, timeoutMs);
}

export function postReport(payload: ReportPayload): Promise<VitalisReport> {
  return request<VitalisReport>(
    '/report',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    // First inference after start-up loads the checkpoint; allow for it.
    30000,
  );
}

export const INDICATOR_ORDER = [
  'acute_stress',
  'cognitive_overload',
  'ans_balance',
  'cv_deconditioning',
  'respiration',
  'cabin_co2',
  'fluid_shift',
  'neuro_fatigue',
  'mito_oxidative',
] as const;

export const STATUS_META: Record<
  IndicatorStatus,
  { label: string; hint: string; tone: 'cyan' | 'blue' | 'amber' | 'neutral' }
> = {
  model: { label: 'Model', hint: 'Learned from labelled data (trained classifier)', tone: 'cyan' },
  signal: { label: 'Signal', hint: 'Computed with a standard formula from the signal', tone: 'blue' },
  proxy: { label: 'Proxy', hint: 'Trend only — not a diagnosis, not validated', tone: 'amber' },
  unavailable: { label: 'Unavailable', hint: 'Needs a sensor or labels the model does not have', tone: 'neutral' },
};
