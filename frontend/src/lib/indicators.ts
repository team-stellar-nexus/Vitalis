import type { VitalisIndicator } from '@/services/vitalisApi';

/**
 * Display bands for the health-intelligence view.
 *
 * These are a presentation rule applied to the backend's own numbers, not a
 * second model: signal/proxy indicators carry a z-score against the astronaut's
 * baseline (|z| >= 2 needs attention, 1-2 watch); model indicators carry a
 * 0-100 score (>= 60 / 30-60). Nothing is re-scored.
 */
export type BandId = 'attention' | 'watch' | 'inRange' | 'unavailable';

export const BANDS: Array<{
  id: BandId;
  label: string;
  description: string;
  dot: string;
  text: string;
  badge: 'red' | 'amber' | 'green' | 'neutral';
}> = [
  {
    id: 'attention',
    label: 'Needs attention',
    description: 'Outside the personal baseline band in this window',
    dot: 'bg-red',
    text: 'text-red',
    badge: 'red',
  },
  {
    id: 'watch',
    label: 'Watch',
    description: 'Moving away from the personal baseline',
    dot: 'bg-amber',
    text: 'text-amber',
    badge: 'amber',
  },
  {
    id: 'inRange',
    label: 'In range',
    description: 'Close to the personal baseline',
    dot: 'bg-green',
    text: 'text-ink',
    badge: 'green',
  },
  {
    id: 'unavailable',
    label: 'Unavailable',
    description: 'No sensor or labelled data for this indicator',
    dot: 'bg-muted',
    text: 'text-muted',
    badge: 'neutral',
  },
];

export function bandOf(indicator: VitalisIndicator): BandId {
  if (indicator.status === 'unavailable' || indicator.value === null) return 'unavailable';
  const z = indicator.deviation_from_baseline_z;
  if (typeof z === 'number') {
    const magnitude = Math.abs(z);
    if (magnitude >= 2) return 'attention';
    if (magnitude >= 1) return 'watch';
    return 'inRange';
  }
  if (typeof indicator.value === 'number') {
    if (indicator.value >= 60) return 'attention';
    if (indicator.value >= 30) return 'watch';
  }
  return 'inRange';
}

export function formatIndicatorValue(indicator: VitalisIndicator): string {
  if (indicator.value === null || indicator.value === undefined) return '—';
  const digits = Math.abs(indicator.value) >= 100 ? 0 : Math.abs(indicator.value) >= 10 ? 1 : 2;
  return indicator.value.toFixed(digits);
}

export function formatDeviation(z: number | null): string {
  if (z === null || z === undefined) return '—';
  return `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2)}σ`;
}

const UNIT_LABEL: Record<string, string> = {
  'risk 0-100': 'risk · 0–100',
  'prob %': 'probability',
};

/** Human-readable unit for the value column. */
export function displayUnit(indicator: VitalisIndicator): string {
  if (!indicator.unit) return '';
  return UNIT_LABEL[indicator.unit] ?? indicator.unit;
}

const UNIT_SHORT: Record<string, string> = {
  'risk 0-100': 'risk',
  'prob %': '%',
};

/** "Acute stress detection 66.1 risk" — label + value, used in summary sentences. */
export function describeIndicator(indicator: VitalisIndicator): string {
  const unit = indicator.unit ? (UNIT_SHORT[indicator.unit] ?? indicator.unit) : '';
  return `${indicator.label} ${formatIndicatorValue(indicator)}${unit ? ` ${unit}` : ''}`;
}
