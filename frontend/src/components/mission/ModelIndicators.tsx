import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { INDICATOR_ORDER, STATUS_META, type VitalisIndicator } from '@/services/vitalisApi';
import { cn, formatUtcClock } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import {
  MODEL_WINDOW_SECONDS,
  SIGNAL_SAMPLE_RATE_HZ,
  useVitalisBackend,
} from '@/state/VitalisBackendProvider';

const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  INDICATOR_ORDER.map((id, index) => [id, index]),
);

const formatValue = (indicator: VitalisIndicator): string => {
  if (indicator.value === null || indicator.value === undefined) return '—';
  const digits = Math.abs(indicator.value) >= 100 ? 0 : Math.abs(indicator.value) >= 10 ? 1 : 2;
  return indicator.value.toFixed(digits);
};

const formatZ = (z: number | null): string => {
  if (z === null || z === undefined) return '—';
  return `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(2)}σ`;
};

const probabilityRows = [
  { key: 'low', label: 'Low', tone: 'bg-green' },
  { key: 'moderate', label: 'Moderate', tone: 'bg-amber' },
  { key: 'high', label: 'High', tone: 'bg-red' },
] as const;

type BandId = 'attention' | 'watch' | 'inRange' | 'unavailable';

const BANDS: Array<{ id: BandId; label: string; dot: string; value: string; badge: 'red' | 'amber' | 'green' | 'neutral' }> = [
  { id: 'attention', label: 'Needs attention', dot: 'bg-red', value: 'text-red', badge: 'red' },
  { id: 'watch', label: 'Watch', dot: 'bg-amber', value: 'text-amber', badge: 'amber' },
  { id: 'inRange', label: 'In range', dot: 'bg-green', value: 'text-ink', badge: 'green' },
  { id: 'unavailable', label: 'Unavailable', dot: 'bg-muted', value: 'text-muted', badge: 'neutral' },
];

/**
 * Display band for one indicator.
 *
 * This is a presentation rule applied to the backend's own numbers, not a new
 * model output: signal/proxy indicators carry a z-score against the astronaut's
 * baseline (|z| >= 2 needs attention, 1-2 watch), model indicators carry a
 * 0-100 score (>= 60 / 30-60). Nothing is invented or re-scored.
 */
function bandOf(indicator: VitalisIndicator): BandId {
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

const UNIT_SHORT: Record<string, string> = {
  'risk 0-100': 'risk',
  'prob %': '%',
};

/** "Acute stress detection 66.1 risk" — label + value, for the summary sentence. */
const withUnit = (indicator: VitalisIndicator): string => {
  const unit = indicator.unit ? (UNIT_SHORT[indicator.unit] ?? indicator.unit) : '';
  return `${indicator.label} ${formatValue(indicator)}${unit ? ` ${unit}` : ''}`;
};

/**
 * Homepage readout for LIVE mode.
 *
 * Every number below is returned by the FastAPI `/report` endpoint. Nothing is
 * synthesised here: indicators the model cannot support arrive with
 * `status: "unavailable"`, are greyed out, and show the backend's own note.
 */
export function ModelIndicators() {
  const { activeProfile, snapshot } = useTelemetry();
  const { state, health, healthError, active, submitNow, refreshHealth, backendUrl } =
    useVitalisBackend();

  const report = active.report;
  const modelLoaded = report?.model?.loaded ?? health?.model?.loaded ?? false;
  const modelError = report?.model?.error ?? health?.model?.error ?? healthError;
  const indicators = [...(report?.indicators ?? [])].sort(
    (a, b) => (STATUS_ORDER[a.id] ?? 99) - (STATUS_ORDER[b.id] ?? 99),
  );
  const bucketed = indicators.map((indicator) => ({ indicator, band: bandOf(indicator) }));
  const inBand = (id: BandId) =>
    bucketed.filter((entry) => entry.band === id).map((entry) => entry.indicator);
  const attention = inBand('attention');
  const watch = inBand('watch');
  const counts: Record<BandId, number> = {
    attention: attention.length,
    watch: watch.length,
    inRange: inBand('inRange').length,
    unavailable: inBand('unavailable').length,
  };
  const summary = attention.length
    ? `${attention.map(withUnit).join(', ')} ${attention.length === 1 ? 'is' : 'are'} outside this astronaut's baseline band in this window.`
    : watch.length
      ? `${watch.map(withUnit).join(', ')} ${watch.length === 1 ? 'is' : 'are'} moving away from the baseline; nothing is outside the band yet.`
      : 'Every computed indicator sits inside this astronaut\u2019s baseline band for this window.';

  return (
    <section className="mb-3">
      <Panel
        bracket
        flush
        eyebrow="Backend model readout · live /report"
        title="What the trained model reports for this astronaut"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone={state === 'online' ? 'green' : state === 'connecting' ? 'amber' : 'red'} dot pulse={state !== 'offline'}>
              {state === 'online' ? 'Backend online' : state === 'connecting' ? 'Connecting' : 'Backend offline'}
            </Badge>
            <Badge tone={modelLoaded ? 'cyan' : 'neutral'}>
              {modelLoaded ? `model loaded · ${report?.model?.num_classes ?? health?.model?.num_classes ?? '?'} classes` : 'model not loaded'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={refreshHealth}>
              <RefreshCw size={11} /> Health
            </Button>
          </div>
        }
      >
        {state === 'offline' && !report && (
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red/30 bg-red/[0.08]">
                <WifiOff size={16} className="text-red" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-micro text-red">No backend connection</div>
                <h2 className="mt-1 font-display text-[19px] font-semibold leading-tight text-ink">
                  The FastAPI backend is not answering
                </h2>
                <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
                  Live mode needs the real service. Start it from the backend repository root, then retry. No
                  simulated conclusions are shown in this panel while it is offline.
                </p>
                <pre className="mt-2 overflow-x-auto rounded border border-line-soft bg-base/50 px-3 py-2 font-mono text-[10px] text-ink/90">
python -m uvicorn api:app --app-dir src --port 8000
                </pre>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-micro text-muted/70">
                  Expected at {backendUrl} · {healthError ?? 'connection refused'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onClick={refreshHealth}>
                <PlugZap size={12} /> Retry connection
              </Button>
              <span className="font-mono text-[10px] uppercase tracking-micro text-muted/60">
                Demo mode still works with synthetic data
              </span>
            </div>
          </div>
        )}

        {state !== 'offline' && !report && (
          <div className="flex items-start gap-3 p-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/[0.08]">
              <Activity size={16} className="text-cyan" />
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-micro text-cyan">
                {active.pending ? 'Running inference' : 'Collecting the model window'}
              </div>
              <h2 className="mt-1 font-display text-[19px] font-semibold leading-tight text-ink">
                {active.pending
                  ? 'Submitting the latest 30 s of PPG to /report'
                  : `Accumulating ${MODEL_WINDOW_SECONDS} s of PPG · ${Math.min(active.spanSeconds, MODEL_WINDOW_SECONDS)} s buffered`}
              </h2>
              <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
                The trained classifier needs a full {MODEL_WINDOW_SECONDS} s window at {SIGNAL_SAMPLE_RATE_HZ} Hz. The
                dashboard keeps every submitted sample per astronaut and posts the last {MODEL_WINDOW_SECONDS} s every
                15 s.
              </p>
              <div className="mt-3 h-1 w-full max-w-md overflow-hidden rounded-full bg-base">
                <div
                  className="h-full rounded-full bg-cyan transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (active.spanSeconds / MODEL_WINDOW_SECONDS) * 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-micro text-muted/70">
                {active.sampleCount} samples buffered · backend {backendUrl}
              </p>
            </div>
          </div>
        )}

        {report && (
          <>
            {state === 'offline' && (
              <div className="flex flex-wrap items-center gap-2 border-b border-amber/25 bg-amber/[0.07] px-4 py-2 font-mono text-[10.5px] uppercase tracking-micro text-amber">
                <WifiOff size={10} /> Backend unreachable · showing the last successful report
                {active.submittedAt ? ` from ${formatUtcClock(new Date(active.submittedAt))} UTC` : ''}
              </div>
            )}
            <div className="grid border-b border-line-soft lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={modelLoaded ? 'cyan' : 'amber'} dot pulse={modelLoaded}>
                    {modelLoaded ? 'Trained classifier' : 'Classifier unavailable'}
                  </Badge>
                  <Badge tone="neutral">{activeProfile.name}</Badge>
                  <Badge tone="neutral">{activeProfile.id}</Badge>
                  {active.restored && <Badge tone="amber">restored · previous session</Badge>}
                  <span className="font-mono text-[10px] uppercase tracking-micro text-muted/70">
                    submitted {active.sampleCount} samples · {active.submittedAt ? formatUtcClock(new Date(active.submittedAt)) : '—'} UTC
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="label-xs">Classifier probabilities</span>
                    <span className="font-mono text-[10px] uppercase tracking-micro text-muted/60">
                      softmax · 3 classes
                    </span>
                  </div>
                  {report.probabilities ? (
                    <div className="mt-2 space-y-1.5">
                      {probabilityRows.map((row) => {
                        const value = report.probabilities?.[row.key] ?? 0;
                        const pct = Math.round(value * 1000) / 10;
                        return (
                          <div key={row.key} className="flex items-center gap-2">
                            <span className="w-16 font-mono text-[11px] uppercase tracking-micro text-muted">
                              {row.label}
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base">
                              <div className={cn('h-full rounded-full', row.tone)} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-14 text-right font-mono text-[12.5px] tabular-nums text-ink">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
                      <AlertTriangle size={11} className="text-amber" />
                      The backend returned no classifier probabilities for this window.
                    </p>
                  )}
                </div>

                {report.notes.length > 0 && (
                  <div className="mt-4 rounded border border-amber/25 bg-amber/[0.05] p-3">
                    <div className="font-mono text-[9.5px] uppercase tracking-micro text-amber">Backend notes</div>
                    <ul className="mt-1 space-y-1">
                      {report.notes.map((note) => (
                        <li key={note} className="flex gap-1.5 text-[11.5px] leading-relaxed text-muted">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber/70" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="border-t border-line-soft bg-base/30 p-4 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-xs">Model & link</span>
                  <CheckCircle2 size={13} className={modelLoaded ? 'text-green' : 'text-amber'} />
                </div>
                <dl className="mt-2 space-y-2 font-mono text-[10.5px] uppercase tracking-micro">
                  <Row label="Endpoint" value={`${backendUrl}/report`} />
                  <Row label="Health" value={`${backendUrl}/health`} />
                  <Row label="Classes" value={String(report.model?.num_classes ?? '—')} />
                  <Row label="Window" value={`${MODEL_WINDOW_SECONDS}s · ${SIGNAL_SAMPLE_RATE_HZ} Hz`} />
                  <Row label="Astronaut" value={activeProfile.profileId} />
                  <Row label="Signal source" value="local sensor generator" />
                </dl>
                {!modelLoaded && modelError && (
                  <p className="mt-2 rounded border border-line-soft bg-base/40 p-2 text-[11px] leading-relaxed text-muted">
                    <span className="text-amber">Checkpoint error · </span>
                    {modelError}
                  </p>
                )}
                <div className="mt-3 rounded border border-line-soft bg-base/40 px-2.5 py-2">
                  <div className="font-mono text-[9.5px] uppercase tracking-micro text-cyan">Medical-device notice</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{report.disclaimer}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={submitNow} disabled={active.pending}>
                    <RefreshCw size={11} /> Resubmit window
                  </Button>
                  <span className="font-mono text-[10px] uppercase tracking-micro text-muted/60">
                    auto every 15 s
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-line-soft">
              <div className="border-b border-line-soft px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-xs !text-[11px]">Which indicators need attention</span>
                  {BANDS.map((band) =>
                    counts[band.id] > 0 ? (
                      <Badge key={band.id} tone={band.badge} dot={band.id === 'attention'} className="!text-[9.5px]">
                        {band.label} {counts[band.id]}
                      </Badge>
                    ) : null,
                  )}
                </div>
                <p className="mt-2 max-w-3xl text-[14px] font-medium leading-relaxed text-ink">{summary}</p>
                <p className="mt-1.5 max-w-3xl text-[11.5px] leading-relaxed text-muted/85">
                  Bands are a display rule over the backend's own numbers — |Δ baseline| ≥ 2σ or a model score ≥ 60
                  needs attention, 1–2σ or 30–60 is watch. Results are shown exactly as `/report` returns them; nothing is
                  re-scored here.
                </p>
              </div>

              {BANDS.map((band) => {
                const items = inBand(band.id);
                if (!items.length) return null;
                return (
                  <div key={band.id} className="border-b border-line-soft last:border-b-0">
                    <div className="bg-base/25">
                      <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-2">
                        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-micro text-ink/85">
                          <span className={cn('h-1.5 w-1.5 rounded-full', band.dot)} aria-hidden />
                          {band.label}
                        </span>
                        <span className="font-mono text-[11px] text-muted">{items.length}</span>
                      </div>
                      {band.id === 'unavailable' && (
                        <p className="max-w-3xl px-4 pb-2 text-[11.5px] leading-relaxed text-muted/85">
                          The backend returns no number for these: the model was never trained on a matching sensor or
                          labelled data. They are listed so the gap stays visible instead of being filled with a guess.
                        </p>
                      )}
                    </div>

                    <div className="divide-y divide-line-soft">
                      {items.map((indicator) => {
                        const meta = STATUS_META[indicator.status];
                        const isUnavailable = band.id === 'unavailable';
                        return (
                          <div
                            key={indicator.id}
                            className={cn(
                              'grid gap-2.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4',
                              isUnavailable && 'opacity-60',
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[15px] font-semibold leading-tight text-ink">{indicator.label}</span>
                                <Badge tone={meta.tone} className="!text-[9px]">
                                  {meta.label}
                                </Badge>
                              </div>
                              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">{indicator.note}</p>
                            </div>

                            <div className="flex items-start justify-between gap-5 sm:justify-end">
                              <div className="text-right">
                                <div
                                  className={cn(
                                    'font-mono text-[22px] font-semibold leading-none tabular-nums',
                                    isUnavailable ? 'text-muted' : band.value,
                                  )}
                                >
                                  {formatValue(indicator)}
                                </div>
                                <div className="mt-1 font-mono text-[10px] uppercase tracking-micro text-muted/70">
                                  {isUnavailable
                                    ? 'no reading'
                                    : indicator.unit === 'risk 0-100'
                                      ? 'risk · 0–100'
                                      : indicator.unit === 'prob %'
                                        ? 'probability'
                                        : (indicator.unit ?? 'backend value')}
                                </div>
                              </div>
                              <div className="min-w-[104px] text-right font-mono text-[11px] leading-snug text-muted">
                                <div>
                                  confidence{' '}
                                  <span className="text-ink/85">
                                    {indicator.confidence === null ? '—' : `${Math.round(indicator.confidence * 100)}%`}
                                  </span>
                                </div>
                                <div>
                                  Δ baseline{' '}
                                  <span className="text-ink/85">{formatZ(indicator.deviation_from_baseline_z)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2 font-mono text-[10px] uppercase tracking-micro text-muted/70">
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={9} className="text-amber" /> Model output · experimental · not a diagnosis
              </span>
              <span>
                Source · FastAPI /report · {snapshot.mission.id} · {activeProfile.id}
              </span>
            </div>
          </>
        )}
      </Panel>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted/70">{label}</dt>
      <dd className="max-w-[62%] truncate text-right text-ink/80 normal-case">{value}</dd>
    </div>
  );
}
