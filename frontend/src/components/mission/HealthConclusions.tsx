import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Sparkline } from '@/components/charts/Sparkline';
import { SENSORS } from '@/lib/sensors';
import type { SensorId, WindowSeconds } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type FindingState = 'new' | 'persistent' | 'improving' | 'resolved' | 'baseline';
type EvidenceSufficiency = 'sufficient' | 'limited' | 'insufficient' | 'none';
type FindingSeverity = 'High' | 'Moderate' | 'Low';

interface Finding {
  id: string;
  eyebrow: string;
  title: string;
  implication: string;
  earlyWarning: string;
  observedChange: string;
  baselineComparison: string;
  evidence: string[];
  supporting: string;
  contradicting: string;
  recommendation: string;
  severity: FindingSeverity;
  state: FindingState;
  sufficiency: EvidenceSufficiency;
  confidence: number;
  channels: SensorId[];
  signalChannel: 'ppg' | 'hrv';
  evidenceRange: WindowSeconds;
}

const STATE_LABEL: Record<FindingState, string> = {
  new: 'New',
  persistent: 'Persistent',
  improving: 'Improving',
  resolved: 'Resolved',
  baseline: 'At baseline',
};

const SUFFICIENCY_LABEL: Record<EvidenceSufficiency, string> = {
  sufficient: 'Sufficient',
  limited: 'Limited',
  insufficient: 'Insufficient evidence',
  none: 'No active deviation',
};

const SEVERITY_TONE = { High: 'red', Moderate: 'amber', Low: 'green' } as const;
const SUFFICIENCY_TONE = { sufficient: 'green', limited: 'amber', insufficient: 'red', none: 'neutral' } as const;

const delta = (current: number, baseline: number, digits = 1) =>
  `${current >= baseline ? '+' : '−'}${Math.abs(current - baseline).toFixed(digits)}`;

function evidenceState(snapshot: ReturnType<typeof useTelemetry>['snapshot']): FindingState {
  if (snapshot.anomaly.status === 'normal') {
    const previouslyFlagged = snapshot.anomaly.log.some((entry) => entry.status !== 'normal');
    return previouslyFlagged ? 'resolved' : 'baseline';
  }
  const first = snapshot.anomaly.log[0];
  if (first && Date.now() - first.detectedAt < 5 * 60 * 1000) return 'new';
  const history = snapshot.anomaly.history;
  if (!history.length) return 'persistent';
  const recent = history.slice(-Math.max(4, Math.floor(history.length * 0.18)));
  const prior = history.slice(
    Math.max(0, history.length - Math.max(8, Math.floor(history.length * 0.36))),
    Math.max(0, history.length - Math.max(4, Math.floor(history.length * 0.18))),
  );
  const avg = (values: typeof history) =>
    values.length ? values.reduce((total, point) => total + point.error, 0) / values.length : 0;
  const change = avg(recent) - avg(prior);
  if (change < -0.0004) return 'improving';
  return 'persistent';
}

/**
 * The homepage's primary readout. Every field below is derived from the active
 * astronaut's snapshot: anomaly status, reconstruction history, flagged windows,
 * witness channels, individual baseline and current measurements. It never
 * produces a diagnosis when the evidence does not support one.
 */
export function HealthConclusions() {
  const { snapshot } = useTelemetry();
  const [expanded, setExpanded] = useState<string | null>('primary');
  const baseline = snapshot.astronaut.baseline;
  const vitals = snapshot.vitals;
  const hrvDelta = vitals.hrv - baseline.hrv;
  const spo2Delta = vitals.spo2 - baseline.spo2;
  const tempDelta = vitals.temp - baseline.temp;
  const sleepDelta = vitals.sleep - baseline.sleep;
  const status = snapshot.anomaly.status;
  const flagged = snapshot.windows.filter((window) => window.flagged);
  const maxFlagged = flagged.length
    ? (Math.max(...flagged.map((window) => window.windowSeconds)) as WindowSeconds)
    : (120 as WindowSeconds);
  const state = evidenceState(snapshot);
  const witnesses = snapshot.fusion.witnesses;
  const witnessLabel = witnesses.length ? witnesses.map((id) => id.toUpperCase()).join(', ') : 'none';
  const evidenceSufficiency: EvidenceSufficiency =
    status === 'normal'
      ? 'none'
      : status === 'confirmed' && witnesses.length >= 1 && flagged.length >= 3
        ? 'sufficient'
        : flagged.length >= 2
          ? 'limited'
          : 'insufficient';
  const confidence =
    status === 'normal' ? 0 : Math.min(94, Math.round(42 + snapshot.anomaly.score * 0.45 + flagged.length * 3 + witnesses.length * 2));

  const primary: Finding = useMemo(() => {
    if (status === 'normal') {
      return {
        id: 'primary',
        eyebrow: 'AI health conclusion · simulated inference',
        title: 'No active early warning detected',
        implication:
          'The current four-window comparison does not identify a baseline-relative physiological deviation requiring review.',
        earlyWarning: 'None · all four reconstruction windows are below the personal mean + 2σ threshold.',
        observedChange: `HRV ${vitals.hrv.toFixed(0)} ms · HR ${vitals.hr.toFixed(0)} BPM · SpO₂ ${vitals.spo2.toFixed(1)}%`,
        baselineComparison: `${snapshot.astronaut.baselineDays}-day personal baseline (${snapshot.astronaut.baselineWindows.toLocaleString()} windows) · HRV ${baseline.hrv} ms · HR ${baseline.hr} BPM.`,
        evidence: [
          'All four autoencoder reconstruction windows remain inside the personal threshold.',
          'No witness channel is co-affected in the current window set.',
          'Noise and physiology vary within the personal baseline band; this is not a clean bill of health.',
        ],
        supporting: 'No co-affected witness channel.',
        contradicting: 'No contradicting channel identified.',
        recommendation:
          'Continue scheduled multi-window monitoring and confirm sensor contact at the next check. No review escalation is indicated by the current evidence.',
        severity: 'Low',
        state: 'baseline',
        sufficiency: 'none',
        confidence: 0,
        channels: ['hr', 'hrv', 'spo2', 'temp', 'activity', 'sleep'],
        signalChannel: 'hrv',
        evidenceRange: 240,
      };
    }

    const confirmed = status === 'confirmed';
    return {
      id: 'primary',
      eyebrow: 'AI health conclusion · simulated inference',
      title: confirmed ? 'Multi-channel physiological deviation' : 'Single-channel early warning',
      implication: confirmed
        ? 'A possible autonomic stress pattern is supported across more than one physiological channel. This is a monitoring flag, not a diagnosis.'
        : 'A possible autonomic stress pattern is present in the HRV channel. Supporting evidence is limited, so this requires review rather than a diagnosis.',
      earlyWarning:
        hrvDelta < 0
          ? `HRV is ${Math.abs(hrvDelta).toFixed(0)} ms below the personal baseline; ${flagged.length}/4 reconstruction windows are above threshold.`
          : `${flagged.length}/4 reconstruction windows are above the personal threshold.`,
      observedChange: `HRV ${vitals.hrv.toFixed(0)} ms vs ${baseline.hrv} ms baseline (${delta(vitals.hrv, baseline.hrv, 0)} ms) · HR ${delta(vitals.hr, baseline.hr, 0)} BPM.`,
      baselineComparison: `${snapshot.astronaut.baselineDays}-day personal baseline · ${snapshot.astronaut.baselineWindows.toLocaleString()} windows · HRV ${baseline.hrv} ms · HR ${baseline.hr} BPM.`,
      evidence: [
        `Window fusion: ${flagged.length}/4 windows above mean + 2σ. Longest flagged window: ${maxFlagged}s.`,
        `Reconstruction error ${snapshot.anomaly.reconstructionError.toFixed(4)} vs threshold ${snapshot.anomaly.threshold.toFixed(4)}.`,
        `Witness channels: ${witnessLabel}. ${witnesses.length ? 'Co-affected channels increase specificity.' : 'No co-affected channel; the pattern remains less specific.'}`,
      ],
      supporting: witnesses.length
        ? `Supporting witness channels: ${witnesses.map((id) => SENSORS[id].label).join(', ')}.`
        : 'No supporting witness channel above threshold.',
      contradicting: witnesses.length
        ? 'No contradicting channel identified in the current window set.'
        : 'A single-channel deviation can reflect artifact or normal variability; it is insufficient for a multi-channel conclusion.',
      recommendation: confirmed
        ? 'Continue 120 s / 240 s fusion monitoring, verify the co-affected channels, and ask the flight surgeon to review the pattern at the next interval.'
        : 'Continue multi-window observation, verify HRV signal quality and check the next recovery aggregate. Do not infer a diagnosis from one channel.',
      severity: confirmed ? 'High' : 'Moderate',
      state,
      sufficiency: evidenceSufficiency,
      confidence,
      channels: confirmed ? ['hr', 'hrv', 'spo2', 'temp'] : ['hr', 'hrv'],
      signalChannel: 'hrv',
      evidenceRange: maxFlagged,
    };
  }, [
    status,
    vitals.hrv,
    vitals.hr,
    vitals.spo2,
    baseline,
    snapshot.astronaut.baselineDays,
    snapshot.astronaut.baselineWindows,
    flagged.length,
    maxFlagged,
    witnessLabel,
    witnesses,
    snapshot.anomaly.reconstructionError,
    snapshot.anomaly.threshold,
    hrvDelta,
    state,
    evidenceSufficiency,
    confidence,
  ]);

  const findings: Finding[] = useMemo(() => {
    const additional: Finding[] = [];

    if (status !== 'normal' && (witnesses.includes('spo2') || vitals.spo2 < 95)) {
      additional.push({
        id: 'oxygenation',
        eyebrow: 'Secondary finding',
        title: 'Oxygenation below personal baseline',
        implication: 'Possible oxygenation deviation. Verify sensor contact before interpreting; this is not a diagnosis.',
        earlyWarning: `SpO₂ ${vitals.spo2.toFixed(1)}% vs ${baseline.spo2.toFixed(1)}% baseline (${delta(vitals.spo2, baseline.spo2, 1)} points).`,
        observedChange: `SpO₂ ${vitals.spo2.toFixed(1)}% · ${witnesses.includes('spo2') ? 'co-affected witness channel' : 'single measurement below baseline'}.`,
        baselineComparison: `Personal baseline ${baseline.spo2.toFixed(1)}% across ${snapshot.astronaut.baselineDays} days.`,
        evidence: [
          `Current SpO₂ ${vitals.spo2.toFixed(1)}% vs baseline ${baseline.spo2.toFixed(1)}%.`,
          witnesses.includes('spo2') ? 'SpO₂ is co-affected in the fusion window.' : 'SpO₂ is not a supporting witness in the current window.',
          `Sensor quality ${snapshot.sensors.find((sensor) => sensor.id === 'spo2')?.quality ?? 0}%.`,
        ],
        supporting: 'Dual-wavelength PPG channel; verify contact and perfusion.',
        contradicting: witnesses.includes('spo2') ? 'No contradicting channel identified.' : 'No independent confirmation beyond the optical channel.',
        recommendation: 'Recheck sensor contact and perfusion, repeat acquisition, and review the 120 s trend with the medical team.',
        severity: witnesses.includes('spo2') ? 'Moderate' : 'Low',
        state,
        sufficiency: witnesses.includes('spo2') ? 'limited' : 'insufficient',
        confidence: Math.min(90, 42 + Math.abs(spo2Delta) * 12),
        channels: ['spo2'],
        signalChannel: 'ppg',
        evidenceRange: maxFlagged,
      });
    }

    if (status !== 'normal' && (witnesses.includes('temp') || tempDelta > 0.3)) {
      additional.push({
        id: 'thermal',
        eyebrow: 'Secondary finding',
        title: 'Thermoregulatory baseline deviation',
        implication: 'Skin temperature is above the personal baseline. It is not a core-temperature measurement.',
        earlyWarning: `Skin temperature ${vitals.temp.toFixed(2)} °C vs ${baseline.temp.toFixed(2)} °C baseline (${delta(vitals.temp, baseline.temp, 2)} °C).`,
        observedChange: `Sternum thermistor ${vitals.temp.toFixed(2)} °C · ${witnesses.includes('temp') ? 'co-affected witness channel' : 'single measurement above baseline'}.`,
        baselineComparison: `Personal baseline ${baseline.temp.toFixed(2)} °C.`,
        evidence: [
          `Thermistor ${vitals.temp.toFixed(2)} °C vs baseline ${baseline.temp.toFixed(2)} °C.`,
          witnesses.includes('temp') ? 'TEMP is co-affected in the current fusion window.' : 'TEMP is not currently a supporting witness.',
          'Surface temperature can be affected by sensor placement and local conditions.',
        ],
        supporting: witnesses.includes('temp') ? 'Co-affected thermal channel.' : 'No independent confirmation.',
        contradicting: 'Skin temperature is not a core-temperature measurement; interpret with placement checks.',
        recommendation: 'Recheck thermistor placement and trend the 240 s window. Do not treat this as a core-temperature diagnosis.',
        severity: witnesses.includes('temp') ? 'Moderate' : 'Low',
        state,
        sufficiency: witnesses.includes('temp') ? 'limited' : 'insufficient',
        confidence: Math.min(86, 38 + Math.abs(tempDelta) * 55),
        channels: ['temp'],
        signalChannel: 'ppg',
        evidenceRange: maxFlagged,
      });
    }

    if (status !== 'normal' && sleepDelta < -8) {
      additional.push({
        id: 'recovery',
        eyebrow: 'Secondary finding',
        title: 'Recovery indicators below baseline',
        implication: 'The recovery aggregate is lower than the personal baseline. This is a monitoring signal, not a sleep or fatigue diagnosis.',
        earlyWarning: `Recovery ${vitals.sleep.toFixed(0)}/100 vs ${baseline.sleep}/100 baseline (${delta(vitals.sleep, baseline.sleep, 0)} points).`,
        observedChange: `Sleep/recovery ${vitals.sleep.toFixed(0)}/100 · activity ${vitals.activity.toFixed(0)} idx.`,
        baselineComparison: `Personal baseline ${baseline.sleep}/100 recovery · ${baseline.activity} activity index.`,
        evidence: [
          `Recovery aggregate ${vitals.sleep.toFixed(0)}/100 vs baseline ${baseline.sleep}/100.`,
          `Activity ${vitals.activity.toFixed(0)} idx vs baseline ${baseline.activity} idx.`,
          'Daily aggregate; no continuous sleep staging is available in the demo stream.',
        ],
        supporting: 'Activity index is available; sleep is a daily aggregate.',
        contradicting: 'No continuous sleep staging or independent recovery channel is present.',
        recommendation: 'Track the next sleep aggregate and daytime activity. Keep the recommendation monitoring-oriented; do not infer a sleep disorder.',
        severity: 'Low',
        state,
        sufficiency: 'insufficient',
        confidence: Math.min(72, 34 + Math.abs(sleepDelta) * 1.3),
        channels: ['sleep', 'activity'],
        signalChannel: 'hrv',
        evidenceRange: maxFlagged,
      });
    }

    return [primary, ...additional];
  }, [
    primary,
    status,
    witnesses,
    vitals.spo2,
    vitals.temp,
    vitals.sleep,
    vitals.activity,
    baseline,
    snapshot.astronaut.baselineDays,
    snapshot.sensors,
    spo2Delta,
    tempDelta,
    sleepDelta,
    state,
    maxFlagged,
  ]);

  const openEvidence = (finding: Finding) => {
    window.dispatchEvent(
      new CustomEvent('nexus:inspect-evidence', {
        detail: { channel: finding.signalChannel, range: finding.evidenceRange },
      }),
    );
    window.requestAnimationFrame(() => {
      document.getElementById('signal-observatory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section className="mb-3">
      <Panel
        bracket
        flush
        eyebrow="Primary readout · AI health conclusions"
        title="What is happening to this astronaut?"
        actions={
          <>
            <Badge tone="cyan" dot pulse>
              SIMULATED INFERENCE
            </Badge>
            <Badge tone="neutral">{snapshot.model.name}</Badge>
          </>
        }
      >
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY_TONE[primary.severity]} dot pulse={primary.severity !== 'Low'}>
                {primary.severity === 'High' ? 'Priority review' : primary.severity === 'Moderate' ? 'Review' : 'Routine'}
              </Badge>
              <Badge tone={primary.state === 'baseline' ? 'green' : primary.state === 'new' ? 'red' : primary.state === 'improving' ? 'blue' : 'amber'}>
                {STATE_LABEL[primary.state]}
              </Badge>
              <Badge tone={SUFFICIENCY_TONE[primary.sufficiency]}>
                {SUFFICIENCY_LABEL[primary.sufficiency]}
              </Badge>
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted/70">
                astronaut-specific baseline · {snapshot.astronaut.baselineDays}d
              </span>
            </div>

            <div className="mt-5 flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/[0.08]">
                <Sparkles size={18} className="text-cyan" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[8.5px] uppercase tracking-micro text-cyan">
                  {primary.eyebrow}
                </div>
                <h2 className="mt-1 max-w-3xl font-display text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">
                  {primary.title}
                </h2>
                <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-muted">{primary.implication}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Readout label="Observed change" value={primary.observedChange} />
              <Readout label="Early warning" value={primary.earlyWarning} />
              <Readout label="Compared against" value={primary.baselineComparison} />
            </div>

            <div className="mt-3 rounded border border-line-soft bg-base/25 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="label-xs">Evidence trace</span>
                <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted/60">
                  measurements → windows → witnesses
                </span>
              </div>
              <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {primary.evidence.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[9px] leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan/70" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid gap-1 border-t border-line-soft pt-1.5 sm:grid-cols-2">
                <TraceRow label="Supporting" value={primary.supporting} />
                <TraceRow label="Contradicting" value={primary.contradicting} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => openEvidence(primary)}>
                <Activity size={12} /> Inspect signal evidence
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  document.getElementById('potential-concerns')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <ArrowDownRight size={12} /> Review actions
              </Button>
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted/60">
                Evidence → waveform · windows · witnesses
              </span>
            </div>
          </div>

          <div className="border-t border-line-soft bg-base/30 p-4 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">Decision support</span>
              <ShieldCheck size={13} className="text-green" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DecisionMetric label="Risk score" value={status === 'normal' ? 'Low' : `${snapshot.anomaly.score}/100`} tone={status === 'normal' ? 'green' : primary.severity === 'High' ? 'red' : 'amber'} />
              <DecisionMetric label="Demo confidence" value={status === 'normal' ? '—' : `${primary.confidence}%`} tone="cyan" />
              <DecisionMetric label="Windows flagged" value={`${flagged.length}/4`} tone={flagged.length >= 2 ? 'amber' : 'green'} />
              <DecisionMetric label="Witnesses" value={`${witnesses.length}`} tone={witnesses.length ? 'amber' : 'neutral'} />
            </div>

            <div className="mt-3 border-t border-line-soft pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="label-xs">Evidence sufficiency</span>
                <Badge tone={SUFFICIENCY_TONE[primary.sufficiency]} className="!text-[7px]">
                  {SUFFICIENCY_LABEL[primary.sufficiency]}
                </Badge>
              </div>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                {primary.sufficiency === 'none'
                  ? 'No active four-window deviation. This readout is not a clinical clearance.'
                  : primary.sufficiency === 'sufficient'
                    ? 'Multi-window fusion plus at least one witness channel support the finding. Still a monitoring flag, not a diagnosis.'
                    : primary.sufficiency === 'limited'
                      ? 'Window evidence is present but witness support is incomplete. Treat as a possible concern requiring review.'
                      : 'The current evidence is insufficient to support a health conclusion. Continue acquisition.'}
              </p>
            </div>

            <div className="mt-3 rounded border border-line-soft bg-base/40 px-2.5 py-2">
              <div className="font-mono text-[7.5px] uppercase tracking-micro text-cyan">Mission medical next step</div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{primary.recommendation}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-line-soft bg-base/20 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="label-xs">Additional conclusions</div>
              <p className="mt-0.5 text-[9px] text-muted/70">
                Shown only when a measured channel crosses its own baseline or is co-affected in fusion.
              </p>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
              {findings.length - 1} secondary finding{findings.length - 1 === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {findings.slice(1).map((finding) => {
              const open = expanded === finding.id;
              return (
                <article key={finding.id} className="rounded border border-line-soft bg-base/35">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : finding.id)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-2 p-2.5 text-left"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-base/60">
                      {finding.severity === 'Low' ? (
                        <Eye size={12} className="text-amber" />
                      ) : (
                        <AlertTriangle size={12} className="text-amber" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[10.5px] font-medium text-ink">{finding.title}</span>
                        <Badge tone={SUFFICIENCY_TONE[finding.sufficiency]} className="!text-[7px]">
                          {SUFFICIENCY_LABEL[finding.sufficiency]}
                        </Badge>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[9px] leading-relaxed text-muted">{finding.earlyWarning}</span>
                    </span>
                    {open ? <ChevronUp size={12} className="mt-0.5 shrink-0 text-muted" /> : <ChevronDown size={12} className="mt-0.5 shrink-0 text-muted" />}
                  </button>
                  {open && (
                    <div className="border-t border-line-soft px-2.5 py-2">
                      <div className="space-y-1.5 text-[9px] leading-relaxed">
                        <TraceRow label="Observed" value={finding.observedChange} />
                        <TraceRow label="Implication" value={finding.implication} />
                        <TraceRow label="Supporting" value={finding.supporting} />
                        <TraceRow label="Contradicting" value={finding.contradicting} />
                        <TraceRow label="Action" value={finding.recommendation} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-line-soft bg-base/30 p-2">
                        {finding.channels.map((id) => {
                          const meta = SENSORS[id];
                          const trend = snapshot.sensors.find((sensor) => sensor.id === id)?.trend ?? [];
                          return (
                            <div key={id} className="min-w-0">
                              <div className="flex items-center justify-between gap-1 font-mono text-[7px] uppercase tracking-micro text-muted">
                                <span>{meta.short}</span>
                                <span className="text-muted/60">recent buffer</span>
                              </div>
                              <Sparkline
                                data={trend}
                                color={meta.color}
                                height={22}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEvidence(finding)}
                        className="mt-2 flex items-center gap-1 font-mono text-[8px] uppercase tracking-micro text-cyan hover:underline"
                      >
                        Inspect signal evidence <ArrowRight size={10} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}

            {findings.length === 1 && (
              <div className="flex items-center gap-2 rounded border border-line-soft bg-base/25 px-2.5 py-3 text-[9.5px] leading-relaxed text-muted md:col-span-2 xl:col-span-2">
                <CheckCircle2 size={13} className="shrink-0 text-green" />
                No additional channel currently crosses its personal baseline. Absence of a finding does not rule out
                a future deviation; the next window set will be re-evaluated.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-2 font-mono text-[8px] uppercase tracking-micro text-muted/70">
          <span className="flex items-center gap-1.5">
            <ShieldAlert size={9} className="text-amber" /> Possible concern / early warning · not a confirmed diagnosis
          </span>
          <span>Source · CAE-4W simulated inference · personal baseline · {snapshot.astronaut.id}</span>
        </div>
      </Panel>
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-base/35 px-2.5 py-2">
      <div className="font-mono text-[7.5px] uppercase tracking-micro text-muted">{label}</div>
      <div className="mt-1 text-[9.5px] leading-relaxed text-ink/90">{value}</div>
    </div>
  );
}

function DecisionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'red' | 'amber' | 'green' | 'cyan' | 'neutral';
}) {
  const color =
    tone === 'red' ? 'text-red' : tone === 'amber' ? 'text-amber' : tone === 'green' ? 'text-green' : tone === 'cyan' ? 'text-cyan' : 'text-muted';
  return (
    <div className="rounded border border-line-soft bg-base/40 px-2 py-1.5">
      <div className="font-mono text-[7px] uppercase tracking-micro text-muted">{label}</div>
      <div className={cn('mt-0.5 font-mono text-[12px] tabular-nums', color)}>{value}</div>
    </div>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-[7px] uppercase tracking-micro text-muted/70">{label} · </span>
      <span className="text-muted">{value}</span>
    </div>
  );
}
