import { Sparkline } from '@/components/charts/Sparkline';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { useTelemetry } from '@/state/TelemetryProvider';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/** Section G — four-window fusion with the simulated alert rule. */
export function MultiWindowPanel() {
  const { snapshot } = useTelemetry();
  const { windows, fusion } = snapshot;

  return (
    <Panel
      bracket
      eyebrow="CAE reconstruction error · per-window thresholds"
      title="Multi-Window Detection"
      actions={
        <Badge tone={fusion.alert ? 'amber' : 'green'} dot pulse={fusion.alert}>
          {fusion.alert ? 'FUSION ALERT' : 'NO ALERT'}
        </Badge>
      }
      flush
    >
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 ${
          fusion.alert ? 'border-amber/25 bg-amber/[0.05]' : 'border-line-soft bg-base/30'
        }`}
      >
        {fusion.alert ? (
          <AlertTriangle size={13} className="text-amber" />
        ) : (
          <CheckCircle2 size={13} className="text-green" />
        )}
        <span className="font-mono text-[10px] uppercase tracking-micro text-ink">
          Fusion rule · {fusion.rule}
        </span>
        <span className="font-mono text-[9px] text-muted">
          {fusion.flaggedCount} of 4 windows crossed
        </span>
        <span className="ml-auto flex items-center gap-1">
          {windows.map((w) => (
            <span
              key={w.windowSeconds}
              title={`${w.windowSeconds}s window ${w.flagged ? 'above' : 'below'} threshold`}
              className={`h-1.5 w-4 rounded-full ${w.flagged ? 'bg-amber' : 'bg-line'}`}
            />
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {windows.map((w) => (
          <div
            key={w.windowSeconds}
            className={`rounded-md border p-2.5 transition-colors ${
              w.flagged ? 'border-amber/30 bg-amber/[0.04]' : 'border-line bg-base/30'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[10px] uppercase tracking-micro text-ink">
                {w.windowSeconds}s window
              </span>
              <Badge tone={w.flagged ? 'amber' : 'green'} dot className="!text-[8px]">
                {w.flagged ? 'ABNORMAL' : 'NORMAL'}
              </Badge>
            </div>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-[19px] leading-none tabular-nums text-ink">
                {w.reconstructionError.toFixed(4)}
              </span>
              <span className="font-mono text-[9px] text-muted">MSE</span>
            </div>
            <div className="mt-0.5 font-mono text-[9px] text-muted">
              threshold {w.threshold.toFixed(4)}
            </div>

            <div className="mt-2">
              <Sparkline
                data={w.history.map((h) => h.error)}
                color={w.flagged ? '#FFB84D' : '#35D9F2'}
                threshold={w.threshold}
                height={34}
              />
            </div>

            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-base">
              <div
                className={`h-full rounded-full ${w.flagged ? 'bg-amber' : 'bg-cyan/70'}`}
                style={{ width: `${Math.min(100, (w.ratio / 1.8) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-micro text-muted">
              <span>{w.model}</span>
              <span className={w.flagged ? 'text-amber' : 'text-muted'}>{w.ratio.toFixed(2)}× thr</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line-soft px-4 py-2 font-mono text-[9px] leading-relaxed text-muted">
        DEMO LOGIC · ≥2 windows above their mean + 2σ threshold raises a risk flag. This fusion rule
        is a stand-in for the final trained model.
      </div>
    </Panel>
  );
}
