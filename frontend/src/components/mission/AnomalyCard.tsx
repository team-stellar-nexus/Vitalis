import { RadialGauge } from '@/components/charts/RadialGauge';
import { StatusBadge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const COLOR = { normal: '#35D49A', suspected: '#FFB84D', confirmed: '#FF5364' } as const;

/** Section D — autoencoder risk inference with per-window evidence. */
export function AnomalyCard() {
  const { snapshot } = useTelemetry();
  const navigate = useNavigate();
  const { anomaly, fusion } = snapshot;

  return (
    <Panel
      bracket
      eyebrow="Autoencoder reconstruction · fusion"
      title="AI Anomaly Detection"
      actions={<StatusBadge status={anomaly.status} />}
      className="h-full"
      bodyClassName="flex flex-col gap-2 p-2.5"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
            Stage 2–3 · simulated inference
          </span>
          <button
            type="button"
            onClick={() => navigate('/anomaly-detection')}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-micro text-cyan hover:underline"
          >
            Analysis <ArrowUpRight size={10} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-stretch">
        <RadialGauge
          value={anomaly.score}
          color={COLOR[anomaly.status]}
          label="Risk score"
          sublabel="window average · 0–100"
          size={230}
          className="mx-auto sm:mx-0"
        />
        <div className="grid w-full min-w-0 flex-1 grid-cols-2 content-center gap-1.5 sm:grid-cols-1">
          <Metric
            label="Reconstruction error"
            value={anomaly.reconstructionError.toFixed(4)}
            unit="MSE"
          />
          <Metric label="Threshold · mean + 2σ" value={anomaly.threshold.toFixed(4)} unit="MSE" />
          <Metric
            label="Flagged windows"
            value={`${fusion.flaggedCount}`}
            unit={`/ ${snapshot.windows.length}`}
            tone={fusion.flaggedCount >= 2 ? 'text-amber' : undefined}
          />
          <Metric
            label="Witness channels"
            value={`${fusion.witnesses.length}`}
            unit="supporting"
            tone={fusion.witnesses.length > 0 ? 'text-red' : undefined}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded border border-line-soft bg-base/30">
        <div className="grid grid-cols-[30px_1fr_42px_40px] items-center gap-1.5 border-b border-line-soft px-2 py-1">
          <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted">Win</span>
          <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted">
            Error / threshold
          </span>
          <span className="text-right font-mono text-[7.5px] uppercase tracking-micro text-muted">
            Ratio
          </span>
          <span className="text-right font-mono text-[7.5px] uppercase tracking-micro text-muted">
            Flag
          </span>
        </div>
        <div className="divide-y divide-line-soft/70">
          {snapshot.windows.map((window) => (
            <div
              key={window.windowSeconds}
              className="grid grid-cols-[30px_1fr_42px_40px] items-center gap-1.5 px-2 py-1.5"
              title={`${window.windowSeconds}s window · error ${window.reconstructionError.toFixed(4)} · threshold ${window.threshold.toFixed(4)}`}
            >
              <span className="font-mono text-[9px] tabular-nums text-ink">{window.windowSeconds}s</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1 font-mono text-[9px] tabular-nums">
                  <span className={window.flagged ? 'text-amber' : 'text-ink'}>
                    {window.reconstructionError.toFixed(4)}
                  </span>
                  <span className="truncate text-[7.5px] text-muted">
                    / {window.threshold.toFixed(4)}
                  </span>
                </div>
                <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-base">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      window.flagged ? 'bg-amber' : 'bg-green/70',
                    )}
                    style={{ width: `${Math.min(100, (window.ratio / 2) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-right font-mono text-[9px] tabular-nums text-muted">
                {window.ratio.toFixed(2)}×
              </span>
              <span
                className={cn(
                  'flex items-center justify-end gap-1 font-mono text-[7.5px] uppercase tracking-micro',
                  window.flagged ? 'text-amber' : 'text-green',
                )}
              >
                <span className={cn('h-1 w-1 rounded-full', window.flagged ? 'bg-amber' : 'bg-green')} />
                {window.flagged ? 'ABN' : 'OK'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded border border-line-soft bg-base/40 px-2 py-1.5">
        <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
          Fusion {fusion.alert ? 'satisfied' : 'not met'} · {fusion.flaggedCount}/{snapshot.windows.length}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
          Witness ≥ 1 · {fusion.witnesses.length}
        </span>
      </div>

      <p className="text-[9px] leading-relaxed text-muted">
        Risk score is an experimental inference from physiological signal deviations, not a medical
        diagnosis. Threshold = mean + 2σ over the baseline window set.
      </p>
    </Panel>
  );
}

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-base/40 px-2 py-1.5">
      <div className="truncate font-mono text-[7.5px] uppercase tracking-micro text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`font-mono text-[13px] tabular-nums ${tone ?? 'text-ink'}`}>{value}</span>
        <span className="truncate font-mono text-[7.5px] uppercase text-muted">{unit}</span>
      </div>
    </div>
  );
}
