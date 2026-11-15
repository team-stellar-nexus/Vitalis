import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { bandOf, BANDS, describeIndicator, formatIndicatorValue, displayUnit } from '@/lib/indicators';
import { SENSORS } from '@/lib/sensors';
import { useTelemetry } from '@/state/TelemetryProvider';
import { useVitalisBackend } from '@/state/VitalisBackendProvider';
import { ArrowRight, Activity, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Conclusion {
  id: string;
  title: string;
  value: string;
  unit: string;
  note: string;
  tone: 'red' | 'amber' | 'green' | 'neutral';
  tag: string;
}

/**
 * Homepage executive summary. In LIVE mode every number is read from the
 * astronaut's latest `/report`; in DEMO mode it is derived from the simulated
 * snapshot. Either way it shows the two or three things that matter now — the
 * full indicator set lives on the Health Intelligence page.
 */
export function HealthSnapshot() {
  const { snapshot, mode } = useTelemetry();
  const { active } = useVitalisBackend();
  const navigate = useNavigate();
  const live = mode === 'live';
  const report = active.report;

  const baseline = snapshot.astronaut.baseline;
  const vitals = snapshot.vitals;
  const status = snapshot.anomaly.status;
  const flaggedWindows = snapshot.windows.filter((window) => window.flagged);
  const witnesses = snapshot.fusion.witnesses;

  let conclusions: Conclusion[] = [];
  let warnings: string[] = [];
  let actions: string[] = [];
  let headline = '';
  let pendingMessage: string | null = null;

  if (live) {
    if (!report) {
      pendingMessage =
        active.pending || active.sampleCount < 1500
          ? `Collecting the 30 s PPG window for ${snapshot.astronaut.name} — ${Math.round(active.spanSeconds)} s buffered.`
          : 'The backend has not returned a report for this astronaut yet.';
      headline = 'Waiting for the first backend report';
    } else {
      const banded = report.indicators.map((indicator) => ({ indicator, band: bandOf(indicator) }));
      const attention = banded.filter((entry) => entry.band === 'attention').map((entry) => entry.indicator);
      const watch = banded.filter((entry) => entry.band === 'watch').map((entry) => entry.indicator);
      const unavailable = banded.filter((entry) => entry.band === 'unavailable').length;
      const predicted = report.probabilities
        ? report.probabilities.high >= report.probabilities.moderate && report.probabilities.high >= report.probabilities.low
          ? { name: 'high', pct: report.probabilities.high, tone: 'red' as const }
          : report.probabilities.moderate >= report.probabilities.low
            ? { name: 'moderate', pct: report.probabilities.moderate, tone: 'amber' as const }
            : { name: 'low', pct: report.probabilities.low, tone: 'green' as const }
        : null;

      headline = predicted
        ? `Classifier: ${predicted.name} stress · ${(predicted.pct * 100).toFixed(1)}%`
        : 'Classifier probabilities unavailable';

      conclusions = [...attention, ...watch]
        .slice(0, 3)
        .map((indicator) => {
          const band = bandOf(indicator);
          return {
            id: indicator.id,
            title: indicator.label,
            value: formatIndicatorValue(indicator),
            unit: displayUnit(indicator),
            note: indicator.note,
            tone: BANDS.find((entry) => entry.id === band)!.badge,
            tag: band === 'attention' ? 'Needs attention' : 'Watch',
          };
        });

      warnings = attention.length
        ? attention.slice(0, 3).map((indicator) => `${describeIndicator(indicator)} — outside the personal baseline band.`)
        : watch.length
          ? watch.slice(0, 3).map((indicator) => `${describeIndicator(indicator)} — moving away from baseline.`)
          : ['No indicator is outside this astronaut’s baseline band in the current window.'];

      actions = attention.length
        ? [
            `Re-submit a fresh 30 s window every 15 s and watch ${attention.map((item) => item.label.toLowerCase()).join(' and ')}.`,
            'Open Health Intelligence for the full indicator set and the backend notes behind each value.',
          ]
        : [
            'Continue scheduled multi-window monitoring; the next report runs automatically every 15 s.',
            unavailable
              ? `${unavailable} indicator${unavailable === 1 ? '' : 's'} could not be computed — no sensor or labelled data for ${unavailable === 1 ? 'it' : 'them'}.`
              : 'All indicators were computable in this window.',
          ];
    }
  } else {
    headline = status === 'confirmed' ? 'High · multi-channel flagged' : status === 'suspected' ? 'Moderate · witness pending' : 'Low · all windows within band';

    const main: Conclusion = {
      id: 'primary',
      title:
        status === 'confirmed'
          ? 'Multi-channel physiological deviation'
          : status === 'suspected'
            ? 'Single-channel early warning'
            : 'No active early warning detected',
      value: `${snapshot.anomaly.score}`,
      unit: '/100 risk',
      note:
        status === 'normal'
          ? 'The four-window comparison finds no baseline-relative deviation requiring review.'
          : `A possible autonomic stress pattern is present in ${status === 'confirmed' ? 'more than one' : 'one'} physiological channel. Monitoring flag, not a diagnosis.`,
      tone: status === 'confirmed' ? 'red' : status === 'suspected' ? 'amber' : 'green',
      tag: status === 'confirmed' ? 'Priority review' : status === 'suspected' ? 'Review' : 'Routine',
    };

    const extra: Conclusion[] = [];
    if (vitals.hrv < baseline.hrv * 0.9) {
      extra.push({
        id: 'hrv',
        title: 'HRV below personal baseline',
        value: `${vitals.hrv.toFixed(0)}`,
        unit: 'MS RMSSD',
        note: `Baseline ${baseline.hrv} ms · ${(vitals.hrv - baseline.hrv).toFixed(0)} ms deviation.`,
        tone: 'amber',
        tag: 'Watch',
      });
    }
    if (vitals.spo2 < baseline.spo2 - 1) {
      extra.push({
        id: 'spo2',
        title: 'Oxygenation below baseline',
        value: `${vitals.spo2.toFixed(1)}`,
        unit: '% SPO₂',
        note: `Baseline ${baseline.spo2.toFixed(1)}% · verify sensor contact before interpreting.`,
        tone: 'amber',
        tag: 'Watch',
      });
    }
    if (vitals.temp > baseline.temp + 0.2) {
      extra.push({
        id: 'temp',
        title: 'Skin temperature above baseline',
        value: `${vitals.temp.toFixed(2)}`,
        unit: '°C',
        note: `Baseline ${baseline.temp.toFixed(2)} °C · skin, not core temperature.`,
        tone: 'amber',
        tag: 'Watch',
      });
    }
    if (vitals.sleep < baseline.sleep - 8) {
      extra.push({
        id: 'recovery',
        title: 'Recovery below baseline',
        value: `${vitals.sleep.toFixed(0)}`,
        unit: '/100',
        note: `Baseline ${baseline.sleep}/100 · daily aggregate, not sleep staging.`,
        tone: 'neutral',
        tag: 'Watch',
      });
    }

    conclusions = [main, ...extra].slice(0, 3);

    warnings = [
      `${flaggedWindows.length}/4 reconstruction windows above mean + 2σ.`,
      `Reconstruction error ${snapshot.anomaly.reconstructionError.toFixed(4)} vs threshold ${snapshot.anomaly.threshold.toFixed(4)}.`,
      witnesses.length
        ? `Witness channels co-affected: ${witnesses.map((id) => SENSORS[id].short).join(', ')}.`
        : 'No witness channel co-affected in the current window.',
    ];

    actions =
      status === 'normal'
        ? ['Continue scheduled multi-window monitoring and confirm sensor contact at the next check.']
        : [
            'Continue 120 s / 240 s fusion monitoring and compare the next HRV window.',
            'Verify the co-affected channels before any escalation.',
          ];
  }

  return (
    <Panel
      bracket
      flush
      className="mb-3"
      eyebrow={live ? 'AI health conclusions · backend model' : 'AI health conclusions · simulated engine'}
      title="What is happening right now"
      actions={
        <>
          <Badge tone={live ? 'amber' : 'cyan'} dot pulse className="!text-[12px]">
            {live ? 'LIVE MODEL' : 'DEMO · SYNTHETIC'}
          </Badge>
          <Button size="sm" variant="ghost" onClick={() => navigate('/health-intelligence')}>
            Full readout <ArrowRight size={13} />
          </Button>
        </>
      }
    >
      <div className="border-b border-line-soft px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Activity size={15} className="text-cyan" />
          <span className="text-[15px] font-medium text-ink">{headline}</span>
          <span className="text-[13px] uppercase tracking-micro text-muted/70">
            {snapshot.astronaut.name} · {snapshot.astronaut.id}
          </span>
        </div>
      </div>

      {pendingMessage ? (
        <div className="px-5 py-6">
          <p className="text-[16px] leading-relaxed text-muted">{pendingMessage}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate('/health-intelligence')}>
            Open Health Intelligence
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          {conclusions.map((conclusion) => (
            <div key={conclusion.id} className="rounded-md border border-line-soft bg-base/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={conclusion.tone} className="!text-[12px]">
                  {conclusion.tag}
                </Badge>
              </div>
              <h3 className="mt-2 text-[19px] font-semibold leading-tight text-ink">{conclusion.title}</h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-ink">
                  {conclusion.value}
                </span>
                <span className="text-[13px] uppercase tracking-micro text-muted/70">{conclusion.unit}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{conclusion.note}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 border-t border-line-soft px-5 py-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 text-[13px] uppercase tracking-micro text-amber">
            <ShieldAlert size={13} /> Early warning signs
          </div>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((warning) => (
              <li key={warning} className="flex gap-2 text-[15px] leading-relaxed text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber/70" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[13px] uppercase tracking-micro text-cyan">Recommended monitoring</div>
          <ul className="mt-2 space-y-1.5">
            {actions.map((action) => (
              <li key={action} className="flex gap-2 text-[15px] leading-relaxed text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan/70" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
