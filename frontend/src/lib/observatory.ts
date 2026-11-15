import type {
  Anomaly,
  SensorId,
  SignalPoint,
  SignalWindowData,
  TelemetrySnapshot,
  WindowSeconds,
} from '@/lib/types';
import { clamp } from '@/lib/utils';
import { generatePPG } from '@/simulation/signal';

export type ObservatoryChannel = 'ppg' | 'hrv';

export interface SignalInterval {
  start: number;
  end: number;
  label: string;
  color: string;
}

export interface SignalMarker {
  t: number;
  label: string;
  color: string;
}

export interface WindowSummary {
  windowSeconds: WindowSeconds;
  error: number;
  threshold: number;
  flagged: boolean;
  ratio: number;
}

const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

function movingAverage(points: SignalPoint[], radius: number): SignalPoint[] {
  if (points.length === 0) return [];
  let sum = 0;
  const prefix = [0];
  points.forEach((point) => {
    sum += point.v;
    prefix.push(sum);
  });
  return points.map((point, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(points.length, index + radius + 1);
    return { t: point.t, v: (prefix[to] - prefix[from]) / (to - from) };
  });
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

/**
 * Build one analysis window from the active simulation snapshot. The raw PPG
 * samples are synthetic; the baseline, residual and smoothed residual are
 * derived from those arrays rather than drawn as decoration.
 *
 * A live backend can return the same `SignalWindowData` shape from
 * `/api/signals/history?channel=ppg&window=120` (with optional processed arrays).
 */
export function buildSignalWindow(
  snapshot: TelemetrySnapshot,
  channel: ObservatoryChannel,
  range: WindowSeconds,
): SignalWindowData {
  if (channel === 'hrv') {
    const history = snapshot.history;
    const last = history[history.length - 1]?.t ?? snapshot.simTime;
    const raw = history
      .filter((point) => point.t >= last - range)
      .map((point) => ({ t: Number((point.t - last).toFixed(2)), v: point.hrv }));
    const baseline = movingAverage(raw, Math.max(3, Math.round(range / 12)));
    const processed = raw.map((point, index) => ({
      t: point.t,
      v: Number((point.v - (baseline[index]?.v ?? point.v)).toFixed(2)),
    }));
    const analyzed = movingAverage(processed, 4);
    return {
      channel: 'hrv',
      label: 'Derived HRV',
      unit: 'ms',
      sampleRateHz: 1,
      windowSeconds: range,
      raw,
      baseline,
      processed,
      analyzed,
      threshold: Number((standardDeviation(processed.map((point) => point.v)) * 2).toFixed(2)),
      simulated: true,
    };
  }

  const stress = clamp(
    snapshot.anomaly.status === 'confirmed' ? 1 : snapshot.anomaly.status === 'suspected' ? 0.62 : 0.06,
    0,
    1,
  );
  const raw = generatePPG({
    nowSec: snapshot.simTime,
    durationSec: range,
    sampleRateHz: 8,
    hr: snapshot.vitals.hr,
    stress,
  });
  const baseline = movingAverage(raw, 12);
  const processed = raw.map((point, index) => ({
    t: point.t,
    v: Number((point.v - (baseline[index]?.v ?? point.v)).toFixed(4)),
  }));
  const analyzed = movingAverage(processed, 3);
  return {
    channel: 'ppg',
    label: 'Photoplethysmography',
    unit: 'a.u.',
    sampleRateHz: 8,
    windowSeconds: range,
    raw,
    baseline,
    processed,
    analyzed,
    threshold: Number((standardDeviation(processed.map((point) => point.v)) * 2).toFixed(4)),
    simulated: true,
  };
}

export function buildAnomalyIntervals(
  snapshot: TelemetrySnapshot,
  range: WindowSeconds,
): SignalInterval[] {
  if (snapshot.anomaly.status === 'normal') return [];
  const last = snapshot.anomaly.history[snapshot.anomaly.history.length - 1]?.t ?? 0;
  const crossed = snapshot.anomaly.history
    .filter((point) => point.error > point.threshold && point.t >= last - range)
    .map((point) => point.t - last);
  const start = crossed.length ? Math.max(-range, Math.min(...crossed)) : -Math.min(range, 45);
  return [
    {
      start,
      end: 0,
      label:
        snapshot.anomaly.status === 'confirmed'
          ? 'CURRENT FLAG · MULTI-CHANNEL'
          : 'CURRENT FLAG · WITNESS PENDING',
      color: snapshot.anomaly.status === 'confirmed' ? '#FF5364' : '#FFB84D',
    },
  ];
}

export function buildAnomalyMarkers(
  snapshot: TelemetrySnapshot,
  anomalies: Anomaly[],
  range: WindowSeconds,
): SignalMarker[] {
  const now = snapshot.lastUpdate;
  const markers = anomalies
    .filter((anomaly) => anomaly.status !== 'normal')
    .map((anomaly) => ({
      t: (anomaly.detectedAt - now) / 1000,
      label: anomaly.id,
      color: anomaly.status === 'confirmed' ? '#FF5364' : '#FFB84D',
    }))
    .filter((marker) => marker.t >= -range && marker.t <= 0);

  if (snapshot.anomaly.status !== 'normal') {
    const current = snapshot.anomaly.current;
    if (current && !markers.some((marker) => marker.label === current.id)) {
      markers.push({
        t: 0,
        label: current.id,
        color: snapshot.anomaly.status === 'confirmed' ? '#FF5364' : '#FFB84D',
      });
    }
  }
  return markers;
}

export const SIGNAL_CHANNEL_META: Record<
  ObservatoryChannel,
  { label: string; short: string; unit: string; color: string; sensor: SensorId }
> = {
  ppg: {
    label: 'Photoplethysmography',
    short: 'PPG',
    unit: 'a.u.',
    color: '#35D9F2',
    sensor: 'hr',
  },
  hrv: {
    label: 'Heart-rate variability',
    short: 'HRV',
    unit: 'ms',
    color: '#9675FF',
    sensor: 'hrv',
  },
};
