import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  BANDS,
  bandOf,
  describeIndicator,
  displayUnit,
  formatDeviation,
  formatIndicatorValue,
  type BandId,
} from '@/lib/indicators';
import { INDICATOR_ORDER, STATUS_META, type VitalisIndicator, type VitalisReport } from '@/services/vitalisApi';
import { useTelemetry } from '@/state/TelemetryProvider';
import {
  MODEL_WINDOW_SECONDS,
  SIGNAL_SAMPLE_RATE_HZ,
  useVitalisBackend,
} from '@/state/VitalisBackendProvider';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ORDER: Record<string, number> = Object.fromEntries(INDICATOR_ORDER.map((id, index) => [id, index]));

const PROBABILITY_ROWS = [
  { key: 'low', label: 'Low', tone: 'bg-green', text: 'text-green' },
  { key: 'moderate', label: 'Moderate', tone: 'bg-amber', text: 'text-amber' },
  { key: 'high', label: 'High', tone: 'bg-red', text: 'text-red' },
] as const;

/**
 * The Health Intelligence readout: everything the FastAPI backend returns for
 * the selected astronaut's latest window. Section A diagnostics are collapsed
 * by default, the classifier probabilities and indicator analysis stay open.
 */
export function ModelReadout() {
  const { activeProfile } = useTelemetry();
  const { state, health, healthError, active, backendUrl, submitNow, refreshHealth, bufferedSeconds } =
    useVitalisBackend();
  const navigate = useNavigate();

  const report = active.report;
  const modelLoaded = report?.model?.loaded ?? health?.model?.loaded ?? false;
  const modelPath = report?.model?.path ?? health?.model?.path ?? null;
  const indicators = [...(report?.indicators ?? [])].sort(
    (a, b) => (ORDER[a.id] ?? 99) - (ORDER[b.id] ?? 99),
  );

  const bucketed = indicators.map((indicator) => ({ indicator, band: bandOf(indicator) }));
  const inBand = (id: BandId) => bucketed.filter((entry) => entry.band === id).map((entry) => entry.indicator);
  const attention = inBand('attention');
  const watch = inBand('watch');
  const counts: Record<BandId, number> = {
    attention: attention.length,
    watch: watch.length,
    inRange: inBand('inRange').length,
    unavailable: inBand('unavailable').length,
  };

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------- A. Backend model readout */}
      <section className="rounded-lg border border-line card-surface inner-hairline shadow-panel">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <div className="label mb-1.5 text-muted/80">A · Backend model readout</div>
            <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink">
              Live model connection
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={state === 'online' ? 'green' : state === 'connecting' ? 'amber' : 'red'}
              dot
              pulse={state !== 'offline'}
              className="!text-[12px]"
            >
              {state === 'online' ? 'Backend online' : state === 'connecting' ? 'Connecting' : 'Backend offline'}
            </Badge>
            <Badge tone={modelLoaded ? 'cyan' : 'amber'} className="!text-[12px]">
              {modelLoaded ? 'Model loaded' : 'Model not loaded'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={refreshHealth}>
              <RefreshCw size={13} /> Health check
            </Button>
          </div>
        </header>

        <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Classifier" value={modelPath ? shortPath(modelPath) : 'Stress classifier'} hint="best_model.pt" />
          <Fact label="Classes" value={`${report?.model?.num_classes ?? health?.model?.num_classes ?? '—'} · low / moderate / high`} />
          <Fact
            label="Input"
            value={active.sampleCount ? `${active.sampleCount.toLocaleString()} samples` : '—'}
            hint={`${SIGNAL_SAMPLE_RATE_HZ} Hz`}
          />
          <Fact label="Analysis window" value={`${MODEL_WINDOW_SECONDS} s`} hint={`${MODEL_WINDOW_SECONDS * SIGNAL_SAMPLE_RATE_HZ} samples`} />
          <Fact label="Astronaut" value={activeProfile.name} hint={activeProfile.profileId} />
          <Fact label="Signal source" value="Local sensor generator" hint="No PPG device attached" />
          <Fact
            label="Last report"
            value={active.submittedAt ? formatClock(active.submittedAt) : '—'}
            hint={active.restored ? 'restored · previous session' : 'this session'}
          />
          <Fact label="Report interval" value="every 15 s" hint={`${Math.min(bufferedSeconds, MODEL_WINDOW_SECONDS)} s buffered`} />
        </div>

        {/* Collapsed technical diagnostics */}
        <details className="group border-t border-line-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02]">
            <span className="flex items-center gap-2">
              <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
              <span className="text-[15px] font-medium text-ink">Model diagnostics</span>
              <span className="font-mono text-[12px] uppercase tracking-micro text-muted/70">
                endpoints · payload · disclaimer
              </span>
            </span>
            <span className="font-mono text-[13px] text-muted">{backendUrl.replace(/^https?:\/\//, '')}</span>
          </summary>
          <div className="grid gap-x-6 gap-y-3 border-t border-line-soft px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Model endpoint" value={`${backendUrl}/report`} mono />
            <Fact label="Health endpoint" value={`${backendUrl}/health`} mono />
            <Fact label="Model checkpoint" value={modelPath ?? '—'} mono />
            <Fact label="Sampling frequency" value={`${SIGNAL_SAMPLE_RATE_HZ} Hz`} />
            <Fact label="Window sent" value={`${MODEL_WINDOW_SECONDS} s · ${MODEL_WINDOW_SECONDS * SIGNAL_SAMPLE_RATE_HZ} samples`} />
            <Fact label="Baseline" value="per astronaut · demo profile" />
          </div>
          <div className="border-t border-line-soft px-5 py-4">
            <div className="label mb-2 text-cyan">Medical-device notice</div>
            <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
              {report?.disclaimer ??
                'Prototype decision support, not a medical device. Model output is experimental and is not a diagnosis.'}
            </p>
          </div>
        </details>
      </section>

      {/* Offline / collecting states */}
      {state === 'offline' && !report && (
        <section className="rounded-lg border border-red/30 bg-red/[0.05] px-5 py-5">
          <div className="flex items-start gap-3">
            <WifiOff size={20} className="mt-0.5 shrink-0 text-red" />
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-semibold text-ink">The FastAPI backend is not answering</h2>
              <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-muted">
                Live model results need the service running. Start it from the backend repository root, then retry. No
                simulated numbers are shown here while it is offline.
              </p>
              <pre className="mt-3 overflow-x-auto rounded border border-line-soft bg-base/60 px-3 py-2 font-mono text-[13px] text-ink/90">
python -m uvicorn api:app --app-dir src --port 8000
              </pre>
              <p className="mt-2 font-mono text-[13px] text-muted/80">
                Expected at {backendUrl} · {healthError ?? 'connection refused'}
              </p>
              <Button className="mt-3" size="sm" variant="primary" onClick={refreshHealth}>
                <PlugZap size={13} /> Retry connection
              </Button>
            </div>
          </div>
        </section>
      )}

      {state !== 'offline' && !report && (
        <section className="rounded-lg border border-line card-surface px-5 py-5">
          <div className="flex items-start gap-3">
            <Activity size={20} className="mt-0.5 shrink-0 text-cyan" />
            <div className="min-w-0">
              <div className="label text-cyan">{active.pending ? 'Running inference' : 'Collecting the model window'}</div>
              <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
                {active.pending
                  ? 'Submitting the latest 30 s of PPG to /report'
                  : `Accumulating ${MODEL_WINDOW_SECONDS} s of PPG · ${Math.min(bufferedSeconds, MODEL_WINDOW_SECONDS)} s buffered`}
              </h2>
              <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-muted">
                The trained classifier needs a full {MODEL_WINDOW_SECONDS} s window at {SIGNAL_SAMPLE_RATE_HZ} Hz. This
                astronaut's samples are buffered separately and posted every 15 s.
              </p>
              <div className="mt-3 h-2 w-full max-w-lg overflow-hidden rounded-full bg-base">
                <div
                  className="h-full rounded-full bg-cyan transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (bufferedSeconds / MODEL_WINDOW_SECONDS) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {report && (
        <>
          <ProbabilitySection report={report} active={active} onResubmit={submitNow} />
          <IndicatorSection groups={{ attention, watch, inRange: inBand('inRange'), unavailable: inBand('unavailable') }} counts={counts} onOpenObservatory={() => navigate('/signal-analysis')} />
          <InterpretationSection report={report} attention={attention} watch={watch} unavailable={counts.unavailable} onOpenObservatory={() => navigate('/signal-analysis')} />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ B */
function ProbabilitySection({
  report,
  active,
  onResubmit,
}: {
  report: VitalisReport;
  active: { submittedAt: number | null; sampleCount: number; restored: boolean; pending: boolean };
  onResubmit: () => void;
}) {
  const probabilities = report.probabilities;
  const predicted = probabilities
    ? probabilities.high >= probabilities.moderate && probabilities.high >= probabilities.low
      ? 'high'
      : probabilities.moderate >= probabilities.low
        ? 'moderate'
        : 'low'
    : null;

  return (
    <section className="rounded-lg border border-line card-surface inner-hairline shadow-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <div className="label mb-1.5 text-muted/80">B · Classifier probabilities</div>
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink">
            Stress class returned by the model
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {predicted && (
            <Badge
              tone={predicted === 'high' ? 'red' : predicted === 'moderate' ? 'amber' : 'green'}
              className="!text-[12px]"
            >
              Predicted · {predicted}
            </Badge>
          )}
          <Badge tone="neutral" className="!text-[12px]">
            {active.restored ? 'restored report' : 'live report'}
          </Badge>
        </div>
      </header>

      <div className="px-5 py-4">
        {probabilities ? (
          <div className="space-y-4">
            {PROBABILITY_ROWS.map((row) => {
              const value = probabilities[row.key];
              const pct = Math.round(value * 1000) / 10;
              return (
                <div key={row.key} className="grid items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)_84px]">
                  <span className="text-[17px] font-medium text-ink">{row.label}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-base">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-right font-mono text-[20px] tabular-nums ${row.text}`}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
            <p className="text-[15px] leading-relaxed text-muted">
              Softmax output over three classes for the {active.sampleCount.toLocaleString()}-sample window submitted
              {active.submittedAt ? ` at ${formatClock(active.submittedAt)}` : ''}. The predicted class is the largest
              probability; the others are shown so a close call stays visible.
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[16px] text-muted">
            <AlertTriangle size={16} className="text-amber" />
            The backend returned no classifier probabilities for this window.
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3">
        <span className="flex items-center gap-2 text-[15px] text-muted">
          <ShieldCheck size={15} className="text-green" /> Model output · experimental · not a diagnosis
        </span>
        <Button size="sm" variant="outline" onClick={onResubmit} disabled={active.pending}>
          <RefreshCw size={13} /> {active.pending ? 'Submitting…' : 'Resubmit window'}
        </Button>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ C + E */
function IndicatorSection({
  groups,
  counts,
  onOpenObservatory,
}: {
  groups: { attention: VitalisIndicator[]; watch: VitalisIndicator[]; inRange: VitalisIndicator[]; unavailable: VitalisIndicator[] };
  counts: Record<BandId, number>;
  onOpenObservatory: () => void;
}) {
  return (
    <section className="rounded-lg border border-line card-surface inner-hairline shadow-panel">
      <header className="border-b border-line-soft px-5 py-4">
        <div className="label mb-1.5 text-muted/80">C · Indicator analysis</div>
        <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink">
          Every indicator returned by the backend
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {BANDS.map((band) =>
            counts[band.id] > 0 ? (
              <Badge key={band.id} tone={band.badge} dot={band.id === 'attention'} className="!text-[12px]">
                {band.label} · {counts[band.id]}
              </Badge>
            ) : null,
          )}
        </div>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
          Bands are a display rule over the backend's own numbers — |Δ baseline| ≥ 2σ or a model score ≥ 60 needs
          attention; 1–2σ or 30–60 is watch. Values are shown exactly as <span className="text-ink/80">/report</span>{' '}
          returns them. Open an indicator to inspect its supporting measurements.
        </p>
      </header>

      {BANDS.map((band) => {
        const items = groups[band.id as keyof typeof groups];
        if (!items.length) return null;
        return (
          <div key={band.id} className="border-t border-line-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-base/25 px-5 py-3">
              <span className="flex items-center gap-2 text-[15px] font-semibold uppercase tracking-micro text-ink/85">
                <span className={`h-2 w-2 rounded-full ${band.dot}`} aria-hidden />
                {band.label}
                <span className="font-normal normal-case tracking-normal text-muted/70">· {band.description}</span>
              </span>
              <span className="font-mono text-[14px] text-muted">{items.length}</span>
            </div>
            {band.id === 'unavailable' && (
              <p className="max-w-3xl px-5 pb-3 text-[15px] leading-relaxed text-muted/85">
                The backend returns no number for these: the model was never trained on a matching sensor or labelled
                data. They are listed so the gap stays visible instead of being filled with a guess.
              </p>
            )}
            <div className="divide-y divide-line-soft border-t border-line-soft">
              {items.map((indicator) => (
                <IndicatorRow key={indicator.id} indicator={indicator} onOpenObservatory={onOpenObservatory} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function IndicatorRow({
  indicator,
  onOpenObservatory,
}: {
  indicator: VitalisIndicator;
  onOpenObservatory: () => void;
}) {
  const band = bandOf(indicator);
  const meta = STATUS_META[indicator.status];
  const unavailable = band === 'unavailable';
  const bandMeta = BANDS.find((entry) => entry.id === band)!;

  return (
    <details className="group/indicator">
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 px-5 py-4 hover:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[19px] font-semibold leading-tight text-ink">{indicator.label}</span>
            <Badge tone={meta.tone} className="!text-[12px]">
              {meta.label}
            </Badge>
            <ChevronDown size={15} className="text-muted transition-transform group-open/indicator:rotate-180" />
          </div>
          <p className="mt-1.5 max-w-3xl text-[16px] leading-relaxed text-muted">{indicator.note}</p>
        </div>
        <div className="flex items-start gap-6">
          <div className="text-right">
            <div className={`font-mono text-[26px] font-semibold leading-none tabular-nums ${unavailable ? 'text-muted' : bandMeta.text}`}>
              {formatIndicatorValue(indicator)}
            </div>
            <div className="mt-1 text-[13px] uppercase tracking-micro text-muted/70">
              {unavailable ? 'no reading' : displayUnit(indicator)}
            </div>
          </div>
        </div>
      </summary>

      <div className="grid gap-4 border-t border-line-soft bg-base/20 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Indicator type" value={meta.label} hint={meta.hint} />
        <Detail
          label="Confidence"
          value={indicator.confidence === null ? 'not provided' : `${Math.round(indicator.confidence * 100)}%`}
        />
        <Detail label="Baseline deviation" value={formatDeviation(indicator.deviation_from_baseline_z)} />
        <Detail
          label="Backend note"
          value={indicator.note}
          span
        />
        <div className="sm:col-span-2 lg:col-span-4">
          <Button size="sm" variant="outline" onClick={onOpenObservatory}>
            <ArrowUpRight size={13} /> Inspect supporting signal
          </Button>
          <span className="ml-3 text-[14px] text-muted/75">Waveform and spectrogram in the Signal Observatory</span>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ D */
function InterpretationSection({
  report,
  attention,
  watch,
  unavailable,
  onOpenObservatory,
}: {
  report: VitalisReport;
  attention: VitalisIndicator[];
  watch: VitalisIndicator[];
  unavailable: number;
  onOpenObservatory: () => void;
}) {
  const probabilities = report.probabilities;
  const predicted = probabilities
    ? probabilities.high >= probabilities.moderate && probabilities.high >= probabilities.low
      ? { name: 'high', pct: probabilities.high }
      : probabilities.moderate >= probabilities.low
        ? { name: 'moderate', pct: probabilities.moderate }
        : { name: 'low', pct: probabilities.low }
    : null;

  const detected = predicted
    ? `The classifier places this window in the ${predicted.name} stress class (${(predicted.pct * 100).toFixed(1)}% of the probability mass).`
    : 'The backend returned no classifier probabilities for this window, so no class is reported.';

  const needing = attention.length
    ? `Outside the personal baseline: ${attention.map(describeIndicator).join(', ')}.`
    : watch.length
      ? `Nothing is outside the baseline band yet, but ${watch.map(describeIndicator).join(', ')} ${watch.length === 1 ? 'is' : 'are'} moving away from it.`
      : 'Every computed indicator sits inside this astronaut’s baseline band for this window.';

  const support = attention.length || watch.length
    ? `Supported by ${[...attention, ...watch]
        .map((indicator) => `${indicator.label.toLowerCase()} (${STATUS_META[indicator.status].label.toLowerCase()})`)
        .join(', ')}${unavailable ? `; ${unavailable} indicator${unavailable === 1 ? '' : 's'} could not be computed.` : '.'}`
    : `${report.notes.length ? report.notes[0] : 'No backend note accompanies this window.'}`;

  const monitor = attention.length
    ? `Re-submit a fresh ${MODEL_WINDOW_SECONDS} s window every 15 s and watch ${attention
        .map((indicator) => indicator.label.toLowerCase())
        .join(' and ')} until ${attention.length === 1 ? 'it returns' : 'they return'} inside the baseline band.`
    : watch.length
      ? `Continue multi-window monitoring and confirm ${watch
          .map((indicator) => indicator.label.toLowerCase())
          .join(', ')} in the next window.`
      : 'Continue scheduled multi-window monitoring and confirm sensor contact at the next check.';

  return (
    <section className="rounded-lg border border-line card-surface inner-hairline shadow-panel">
      <header className="border-b border-line-soft px-5 py-4">
        <div className="label mb-1.5 text-muted/80">D · Health interpretation</div>
        <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink">
          What this window means
        </h2>
      </header>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-2">
        <Block title="What the model detected" body={detected} />
        <Block title="Which indicators need attention" body={needing} />
        <Block title="What supports the finding" body={support} />
        <Block title="What to monitor next" body={monitor} />
      </div>

      {report.notes.length > 0 && (
        <div className="mx-5 mb-5 rounded border border-amber/25 bg-amber/[0.05] p-4">
          <div className="label mb-2 text-amber">Backend notes</div>
          <ul className="space-y-1.5">
            {report.notes.map((note) => (
              <li key={note} className="flex gap-2 text-[15px] leading-relaxed text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber/70" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-4">
        <span className="flex items-center gap-2 text-[15px] text-muted">
          <ShieldAlert size={15} className="text-amber" /> Monitoring flag only · not a diagnosis or treatment
        </span>
        <Button size="sm" variant="outline" onClick={onOpenObservatory}>
          Open Signal Observatory <ArrowUpRight size={13} />
        </Button>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ bits */
function Fact({ label, value, hint, mono = false }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] uppercase tracking-micro text-muted/75">{label}</div>
      <div className={`mt-1 truncate text-[16px] leading-snug text-ink ${mono ? 'font-mono text-[15px]' : ''}`} title={value}>
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate font-mono text-[13px] text-muted/60">{hint}</div>}
    </div>
  );
}

function Detail({ label, value, hint, span = false }: { label: string; value: string; hint?: string; span?: boolean }) {
  return (
    <div className={span ? 'min-w-0 sm:col-span-2 lg:col-span-1' : 'min-w-0'}>
      <div className="text-[13px] uppercase tracking-micro text-muted/75">{label}</div>
      <div className="mt-1 text-[15px] leading-relaxed text-ink/90">{value}</div>
      {hint && <div className="mt-0.5 text-[13px] leading-relaxed text-muted/60">{hint}</div>}
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-line-soft bg-base/30 p-4">
      <div className="text-[13px] uppercase tracking-micro text-cyan">{title}</div>
      <p className="mt-2 text-[16px] leading-relaxed text-ink/90">{body}</p>
    </div>
  );
}

function shortPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function formatClock(ms: number): string {
  const date = new Date(ms);
  return `${date.toISOString().slice(11, 19)}Z`;
}
