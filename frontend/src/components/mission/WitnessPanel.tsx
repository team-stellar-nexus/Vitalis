import { Badge, CHANNEL_TONE } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import type { SensorId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { useState } from 'react';

const ORDER: SensorId[] = ['hrv', 'spo2', 'temp', 'activity', 'sleep'];
const SHORT: Record<SensorId, string> = {
  hrv: 'HRV',
  spo2: 'SpO₂',
  temp: 'TEMP',
  activity: 'ACT',
  sleep: 'REC',
  hr: 'HR',
};

const BASE: Record<string, Record<string, number>> = {
  hrv: { hrv: 1, spo2: 0.52, temp: 0.44, activity: 0.3, sleep: 0.27 },
  spo2: { hrv: 0.52, spo2: 1, temp: 0.49, activity: 0.28, sleep: 0.31 },
  temp: { hrv: 0.44, spo2: 0.49, temp: 1, activity: 0.34, sleep: 0.26 },
  activity: { hrv: 0.3, spo2: 0.28, temp: 0.34, activity: 1, sleep: 0.61 },
  sleep: { hrv: 0.27, spo2: 0.31, temp: 0.26, activity: 0.61, sleep: 1 },
};

const STATUS_LABEL = { normal: 'NORMAL', anomaly: 'ANOMALY', nodata: 'NO DATA' } as const;

/** Section H — witness-channel validation with an embedding-correlation matrix. */
export function WitnessPanel({ compact = false }: { compact?: boolean }) {
  const { snapshot } = useTelemetry();
  const [hover, setHover] = useState<{ a: SensorId; b: SensorId } | null>(null);
  const hrvActive = snapshot.witnesses.find((w) => w.id === 'hrv')?.status === 'anomaly';
  const scale = snapshot.anomaly.status === 'normal' ? 1 : snapshot.anomaly.status === 'suspected' ? 1.18 : 1.45;

  const value = (a: SensorId, b: SensorId) => {
    if (a === b) return 1;
    const base = BASE[a][b] * scale;
    const boost = hrvActive && (a === 'hrv' || b === 'hrv') ? 1.16 : 1;
    return Math.min(0.98, Number((base * boost).toFixed(2)));
  };

  const cellTone = (v: number) => {
    if (v >= 0.7) return 'text-amber border-amber/35 bg-amber/[0.16]';
    if (v >= 0.5) return 'text-cyan border-cyan/25 bg-cyan/[0.09]';
    return 'text-muted border-line-soft bg-base/40';
  };

  return (
    <Panel
      bracket
      eyebrow="Ω-neuron style correlation · cosine similarity"
      title="Witness Channel Validation"
      actions={
        <Badge tone={snapshot.fusion.witnesses.length > 0 ? 'red' : 'green'} dot>
          {snapshot.fusion.witnesses.length} supporting
        </Badge>
      }
      className="h-full"
      bodyClassName="flex flex-col gap-3 p-3"
      footer={
        <span className="font-mono text-[9px] leading-relaxed text-muted">
          Rule · ≥1 co-affected channel confirms the event; otherwise it is logged as a suspected
          artifact. Sleep is a daily aggregate and has no continuous window.
        </span>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="label-xs">Cosine similarity</span>
            {hrvActive && <span className="font-mono text-[8px] uppercase tracking-micro text-amber">HRV active</span>}
          </div>
          <div className="inline-grid grid-cols-[22px_repeat(5,minmax(0,1fr))] gap-1">
            <span />
            {ORDER.map((id) => (
              <span
                key={id}
                className={cn(
                  'text-center font-mono text-[8px] uppercase tracking-micro',
                  hrvActive && id === 'hrv' ? 'text-amber' : 'text-muted',
                )}
              >
                {SHORT[id]}
              </span>
            ))}
            {ORDER.map((row) => (
              <div key={row} className="contents">
                <span
                  className={cn(
                    'flex items-center font-mono text-[8px] uppercase tracking-micro',
                    hrvActive && row === 'hrv' ? 'text-amber' : 'text-muted',
                  )}
                >
                  {SHORT[row]}
                </span>
                {ORDER.map((col) => {
                  const v = value(row, col);
                  const diagonal = row === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onMouseEnter={() => setHover({ a: row, b: col })}
                      onFocus={() => setHover({ a: row, b: col })}
                      onMouseLeave={() => setHover(null)}
                      onBlur={() => setHover(null)}
                      aria-label={`${SHORT[row]} to ${SHORT[col]} similarity ${v}`}
                      className={cn(
                        'relative flex h-[26px] w-[38px] items-center justify-center rounded-sm border font-mono text-[8.5px] tabular-nums transition-transform hover:scale-[1.06]',
                        diagonal ? 'border-line bg-white/[0.02] text-muted/60' : cellTone(v),
                        hrvActive && (row === 'hrv' || col === 'hrv') && !diagonal && 'ring-1 ring-amber/25',
                      )}
                    >
                      {diagonal ? '—' : v.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-1.5 h-4 font-mono text-[8.5px] text-muted" aria-live="polite">
            {hover ? (
              <span>
                {SHORT[hover.a]} ↔ {SHORT[hover.b]} · r={value(hover.a, hover.b).toFixed(2)}
                {value(hover.a, hover.b) >= 0.7 ? ' · co-affected' : ' · independent'}
              </span>
            ) : (
              <span className="text-muted/60">Hover a cell for pair details</span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="label-xs mb-1.5">Channel verdicts</div>
          <div className="space-y-1">
            {snapshot.witnesses.map((w) => (
              <div
                key={w.id}
                className={cn(
                  'flex items-center gap-2 rounded border px-2 py-1.5',
                  w.status === 'anomaly'
                    ? 'border-red/25 bg-red/[0.05]'
                    : w.status === 'nodata'
                      ? 'border-line-soft bg-base/30'
                      : 'border-line-soft bg-base/25',
                )}
              >
                <span className="w-9 shrink-0 font-mono text-[9px] uppercase tracking-micro text-ink">
                  {SHORT[w.id]}
                </span>
                <Badge tone={CHANNEL_TONE[w.status]} className="!px-1 !text-[8px]">
                  {STATUS_LABEL[w.status]}
                </Badge>
                <span className="ml-auto font-mono text-[9px] tabular-nums text-muted">
                  {w.status === 'nodata' ? '—' : `${w.score.toFixed(2)}×`}
                </span>
                {w.supporting && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red anim-pulse-dot" aria-label="supporting witness" />
                )}
              </div>
            ))}
          </div>
          {!compact && (
            <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
              When HRV triggers, auxiliary channels are scored in the same window. Supporting channels
              raise confirmation from suspected to confirmed.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
