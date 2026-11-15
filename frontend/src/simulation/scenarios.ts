import type { DemoScenario } from '@/lib/types';

export interface ScenarioMeta {
  id: DemoScenario;
  label: string;
  short: string;
  description: string;
  expected: string;
  intensity: number;
  accent: 'green' | 'amber' | 'red';
  pipeline: string;
}

/**
 * Demo scenarios correspond to the three states described in the project plan:
 * normal monitoring, a single-channel suspicion, and a multi-channel confirmed
 * event. The numbers are synthetic and deliberately plausible only.
 */
export const SCENARIOS: Record<DemoScenario, ScenarioMeta> = {
  normal: {
    id: 'normal',
    label: 'Normal Monitoring',
    short: 'NORMAL',
    description:
      'Baseline physiology. Reconstruction error stays under the mean + 2σ threshold on every window.',
    expected: '0–1 windows flagged · no witness channel co-affected',
    intensity: 0,
    accent: 'green',
    pipeline: 'CAE inference · all channels nominal',
  },
  suspected: {
    id: 'suspected',
    label: 'Suspected Anomaly',
    short: 'SUSPECTED',
    description:
      'HRV deviates for several minutes. Longer windows cross threshold while short windows remain quiet — a pattern typical of a slow autonomic shift.',
    expected: '3 of 4 windows flagged · HRV only, no supporting channel',
    intensity: 0.62,
    accent: 'amber',
    pipeline: 'Fusion rule met · witness validation pending',
  },
  confirmed: {
    id: 'confirmed',
    label: 'Confirmed Multi-Channel',
    short: 'CONFIRMED',
    description:
      'HRV, SpO₂ and skin temperature deviate together across all four windows, satisfying the fusion and witness rules.',
    expected: '4 of 4 windows flagged · SpO₂ + temperature supporting',
    intensity: 1,
    accent: 'red',
    pipeline: 'Fusion + witness rule met · risk alert',
  },
};

export const SCENARIO_LIST = [SCENARIOS.normal, SCENARIOS.suspected, SCENARIOS.confirmed];

export const WINDOW_SECONDS = [30, 60, 120, 240] as const;

export const WINDOW_THRESHOLDS = {
  30: 0.0142,
  60: 0.0168,
  120: 0.0195,
  240: 0.0217,
} as const;

/** Longer windows accumulate slowly-developing deviations, so they react harder. */
export const WINDOW_SENSITIVITY = {
  30: 0.6,
  60: 0.85,
  120: 1.0,
  240: 1.12,
} as const;

/** A channel only counts as a witness above these normalised levels. */
export const WITNESS_LEVELS = {
  hrv: 0.08,
  spo2: 0.7,
  temp: 0.82,
  activity: 1.3,
  sleep: Number.POSITIVE_INFINITY,
  hr: Number.POSITIVE_INFINITY,
} as const;
