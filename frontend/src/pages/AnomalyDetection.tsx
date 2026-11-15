import { TrendChart } from '@/components/charts/TrendChart';
import { WitnessPanel } from '@/components/mission/WitnessPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import type { WindowSeconds } from '@/lib/types';
import { downloadBlob, formatUtcStamp } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Download, GitBranch, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export function AnomalyDetection() {
  const { snapshot } = useTelemetry();
  const [selected, setSelected] = useState<WindowSeconds>(60);
  const active = snapshot.windows.find((w) => w.windowSeconds === selected) ?? snapshot.windows[0];
  const { anomaly, fusion, model } = snapshot;

  const errorData = active.history.map((h) => ({ t: h.t, error: h.error }));
  const maxT = errorData[errorData.length - 1]?.t ?? 0;
  const maxError = Math.max(active.threshold * 1.8, ...errorData.map((d) => d.error));

  const exportLog = () => {
    const header = 'event_id,detected_at_utc,status,score,windows_flagged,witness_channels';
    const rows = anomaly.log.map((a) =>
      [a.id, new Date(a.detectedAt).toISOString(), a.status, a.score, a.windowsFlagged, a.witnesses.join('|')].join(','),
    );
    downloadBlob(
      new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }),
      `vitalis-anomalies-${snapshot.mission.id}.csv`,
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Stage 2–4 · autoencoder, fusion and witness validation"
        title="Anomaly Detection"
        description="Reconstruction-error curves against per-window mean + 2σ thresholds, the four-window fusion rule, and the supporting-channel verdict that upgrades a suspicion to a confirmed risk."
        actions={
          <>
            <Badge tone={anomaly.status === 'normal' ? 'green' : anomaly.status === 'suspected' ? 'amber' : 'red'} dot pulse>
              {anomaly.status.toUpperCase()}
            </Badge>
            <Button size="sm" variant="outline" onClick={exportLog}>
              <Download size={12} /> Export log CSV
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-4">
          <Panel
            bracket
            eyebrow="Window-averaged normalised error"
            title="Risk Assessment"
            className="h-full"
            actions={<StatusBadge status={anomaly.status} />}
            bodyClassName="p-3"
            footer={
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                Experimental inference · not a diagnosis
              </span>
            }
          >
            <div className="flex items-center justify-center py-2">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{
                    background:
                      anomaly.status === 'confirmed'
                        ? 'rgba(255,83,100,0.14)'
                        : anomaly.status === 'suspected'
                          ? 'rgba(255,184,77,0.12)'
                          : 'rgba(53,212,154,0.1)',
                  }}
                />
                <div className="relative flex h-[196px] w-[196px] flex-col items-center justify-center rounded-full border border-line/70 bg-base/30">
                  <div className="label-xs">Risk score</div>
                  <div className="mt-1 font-mono text-[46px] leading-none tracking-tighter text-ink">
                    {anomaly.score}
                  </div>
                  <div className="font-mono text-[10px] text-muted">/ 100</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-5 rounded-full ${i < fusion.flaggedCount ? 'bg-amber' : 'bg-line'}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-micro text-muted">
                    {fusion.flaggedCount} of 4 windows
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Reconstruction error" value={anomaly.reconstructionError.toFixed(4)} unit="MSE" />
              <Metric label="Threshold" value={anomaly.threshold.toFixed(4)} unit="MSE" />
              <Metric label="Witness channels" value={`${fusion.witnesses.length}`} unit="supporting" />
              <Metric label="Model" value={model.name} unit={model.version} />
            </div>

            <div className="mt-2 rounded border border-amber/20 bg-amber/[0.04] px-2.5 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-micro text-amber">
                <ShieldAlert size={10} /> Interpretation guard
              </div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-muted">
                Risk score is an experimental inference from physiological signal deviations, not a
                medical diagnosis. No disease or direct biomarker is measured.
              </p>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-8">
          <Panel
            bracket
            eyebrow="Per-window reconstruction error · mean + 2σ"
            title="Reconstruction Error"
            actions={
              <Segmented
                label="Window"
                options={[
                  { value: 30, label: '30s' },
                  { value: 60, label: '60s' },
                  { value: 120, label: '120s' },
                  { value: 240, label: '240s' },
                ]}
                value={selected}
                onChange={(v) => setSelected(v as WindowSeconds)}
              />
            }
            className="h-full"
            bodyClassName="p-3"
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-micro text-muted">
                <span>
                  {selected}s window · model {active.model} · ratio {active.ratio.toFixed(2)}×
                </span>
                <span className={active.flagged ? 'text-amber' : 'text-green'}>
                  {active.flagged ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD'}
                </span>
              </div>
            }
          >
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-micro text-muted">
                <span className="h-[2px] w-3 rounded" style={{ background: '#35D9F2' }} /> error
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-micro text-muted">
                <span className="h-[2px] w-3 rounded border-t border-dashed border-amber" /> threshold
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-ink">
                {active.reconstructionError.toFixed(4)}
                <span className="ml-1 text-[8px] text-muted">MSE</span>
              </span>
            </div>
            <TrendChart
              data={errorData}
              series={[{ key: 'error', label: 'Error', color: '#35D9F2', type: 'area', unit: 'MSE' }]}
              height={286}
              yDomain={[0, Number((maxError * 1.08).toFixed(4))]}
              tickFormatter={(v) => `${Math.round(v - maxT)}s`}
              tooltipLabel={(v) => `T${Math.round(v - maxT)}s`}
              tooltipDecimals={4}
              referenceLines={[{ y: active.threshold, label: 'mean + 2σ', color: '#FFB84D' }]}
            />
          </Panel>
        </div>
      </div>

      <div className="mb-3">
        <Panel
          bracket
          eyebrow="Four-window fusion · simulated decision rule"
          title="Multi-Window Fusion Results"
          actions={
            <Badge tone={fusion.alert ? 'amber' : 'green'} dot>
              {fusion.alert ? 'FUSION SATISFIED' : 'NO FUSION'}
            </Badge>
          }
          bodyClassName="p-0"
          footer={
            <span className="font-mono text-[9px] leading-relaxed text-muted">
              DEMO LOGIC · ≥2 windows above threshold raises a risk flag. Persistence across windows
              suggests a physiological event rather than a short artifact.
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-base/40">
                  {['Window', 'Reconstruction error', 'Threshold', 'Ratio', 'Flag', 'Witness support'].map((h) => (
                    <th key={h} className="px-3 py-2 font-mono text-[8px] uppercase tracking-micro text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.windows.map((w) => (
                  <tr key={w.windowSeconds} className="border-b border-line-soft/70 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-[11px] text-ink">{w.windowSeconds}s</td>
                    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-ink">
                      {w.reconstructionError.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted">
                      {w.threshold.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted">
                      {w.ratio.toFixed(2)}×
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={w.flagged ? 'amber' : 'green'} dot>
                        {w.flagged ? 'ABNORMAL' : 'NORMAL'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted">
                      {w.flagged && fusion.witnesses.length > 0
                        ? fusion.witnesses.join(', ').toUpperCase()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 font-mono text-[9px] uppercase tracking-micro ${
              fusion.alert ? 'border-amber/25 bg-amber/[0.05] text-amber' : 'border-line-soft text-muted'
            }`}
          >
            <GitBranch size={11} />
            <span>{fusion.rule}</span>
            <span>·</span>
            <span>{fusion.flaggedCount} flagged</span>
            <span>·</span>
            <span>
              verdict {fusion.status.toUpperCase()} ({fusion.witnesses.length} witness)
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel
            bracket
            eyebrow="Session anomaly log"
            title="Detection History"
            actions={<Badge tone="neutral">{anomaly.log.length}</Badge>}
            className="h-full"
            bodyClassName="p-0"
            footer={
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                Includes seeded historical events and live transitions
              </span>
            }
          >
            <ol className="divide-y divide-line-soft">
              {anomaly.log.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      entry.status === 'confirmed' ? 'bg-red' : entry.status === 'suspected' ? 'bg-amber' : 'bg-green'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-ink">{entry.id}</span>
                      <StatusBadge status={entry.status} />
                      <span className="ml-auto font-mono text-[9px] tabular-nums text-muted">
                        {formatUtcStamp(new Date(entry.detectedAt))}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">{entry.summary}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[8.5px] uppercase tracking-micro text-muted/80">
                      <span>RISK {entry.score}</span>
                      <span>
                        WIN {entry.windowsFlagged}/{entry.windowCount}
                      </span>
                      <span>WITNESS {entry.witnesses.length ? entry.witnesses.join(', ') : 'none'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="min-w-0 space-y-3 xl:col-span-5">
          <Panel bracket eyebrow="Stage 2 · trained baseline" title="Model Card" bodyClassName="p-0">
            <div className="divide-y divide-line-soft">
              {[
                ['Model', model.name],
                ['Architecture', model.architecture],
                ['Baseline windows', `${model.baselineWindows.toLocaleString()} · 14 days`],
                ['Threshold rule', model.thresholdRule],
                ['Window set', `${model.windowSet.join(' / ')} s`],
                ['Inference latency', `${model.inferenceMs} ms`],
                ['Version', model.version],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-micro text-muted">{k}</span>
                  <span className="ml-auto text-right font-mono text-[9.5px] text-ink">{v}</span>
                </div>
              ))}
            </div>
            <p className="border-t border-line-soft px-3 py-2 text-[9.5px] leading-relaxed text-muted">
              Simulated inference. The production autoencoder, window buffers and thresholds will be
              supplied by the signal-processing service.
            </p>
          </Panel>

          <WitnessPanel compact />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded border border-line-soft bg-base/40 px-2 py-1.5">
      <div className="font-mono text-[8px] uppercase tracking-micro text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-[13px] tabular-nums text-ink">{value}</span>
        <span className="font-mono text-[8px] text-muted">{unit}</span>
      </div>
    </div>
  );
}
