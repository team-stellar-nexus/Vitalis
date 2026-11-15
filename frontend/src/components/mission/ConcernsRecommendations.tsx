import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SENSORS } from '@/lib/sensors';
import type { SensorId } from '@/lib/types';
import { useTelemetry } from '@/state/TelemetryProvider';
import { AlertTriangle, CheckCircle2, Eye, ShieldCheck } from 'lucide-react';

type ConcernSeverity = 'monitor' | 'watch' | 'clear';

interface Concern {
  id: string;
  title: string;
  deviation: string;
  measurement: string;
  interval: string;
  severity: ConcernSeverity;
  confidence: number;
  witnesses: SensorId[];
  nextStep: string;
  color: string;
}

const SEVERITY_TONE: Record<ConcernSeverity, 'red' | 'amber' | 'green'> = {
  monitor: 'red',
  watch: 'amber',
  clear: 'green',
};

const WITNESS_LABEL: Record<SensorId, string> = {
  hr: 'HR',
  hrv: 'HRV',
  spo2: 'SpO₂',
  temp: 'TEMP',
  activity: 'ACT',
  sleep: 'RECOVERY',
};

export function ConcernsRecommendations() {
  const { snapshot } = useTelemetry();
  const baseline = snapshot.astronaut.baseline;
  const vitals = snapshot.vitals;
  const hrvDelta = vitals.hrv - baseline.hrv;
  const spo2Delta = vitals.spo2 - baseline.spo2;
  const tempDelta = vitals.temp - baseline.temp;
  const sleepDelta = vitals.sleep - baseline.sleep;
  const status = snapshot.anomaly.status;
  const witnesses = snapshot.fusion.witnesses;
  const flagged = snapshot.windows.filter((window) => window.flagged);
  const intervalLabel = flagged.length
    ? `Last ${Math.max(...flagged.map((window) => window.windowSeconds))} s · ${flagged.length}/4 windows flagged`
    : 'Current 30–240 s window set';

  const concerns: Concern[] = [];

  if (status !== 'normal') {
    concerns.push({
      id: 'concern-autonomic',
      title: 'Potential autonomic stress pattern',
      deviation:
        hrvDelta < 0
          ? `HRV is ${Math.abs(hrvDelta).toFixed(0)} ms below the personal baseline while reconstruction error is above threshold.`
          : 'Multi-window reconstruction error is above the personal baseline threshold.',
      measurement: 'HRV · derived from R-R intervals',
      interval: intervalLabel,
      severity: status === 'confirmed' ? 'monitor' : 'watch',
      confidence: Math.min(94, Math.round(42 + snapshot.anomaly.score * 0.45 + flagged.length * 3 + witnesses.length * 2)),
      witnesses,
      nextStep:
        'Continue 120 s / 240 s fusion monitoring, compare the next HRV window, and ask the flight surgeon to review if the pattern persists through the next review interval.',
      color: SENSORS.hrv.color,
    });
  }

  if (spo2Delta < -0.8 || (status === 'confirmed' && witnesses.includes('spo2'))) {
    concerns.push({
      id: 'concern-oxygenation',
      title: 'Oxygenation baseline deviation',
      deviation: `SpO₂ is ${Math.abs(spo2Delta).toFixed(1)} percentage points below the personal baseline.`,
      measurement: 'SpO₂ · dual-wavelength PPG',
      interval: intervalLabel,
      severity: status === 'confirmed' ? 'watch' : 'watch',
      confidence: Math.min(91, 50 + Math.abs(spo2Delta) * 12 + (witnesses.includes('spo2') ? 15 : 0)),
      witnesses,
      nextStep:
        'Verify sensor contact and perfusion, repeat acquisition, and watch the 120 s trend. A single reading is not a diagnosis.',
      color: SENSORS.spo2.color,
    });
  }

  if (tempDelta > 0.25 || (status === 'confirmed' && witnesses.includes('temp'))) {
    concerns.push({
      id: 'concern-thermal',
      title: 'Thermoregulatory baseline deviation',
      deviation: `Skin temperature is ${tempDelta.toFixed(2)} °C above the personal baseline; this is not core temperature.`,
      measurement: 'Skin temperature · sternum thermistor',
      interval: intervalLabel,
      severity: status === 'confirmed' ? 'watch' : 'watch',
      confidence: Math.min(88, 44 + Math.abs(tempDelta) * 55 + (witnesses.includes('temp') ? 14 : 0)),
      witnesses,
      nextStep:
        'Recheck thermistor placement and trend the 240 s window. Interpret only with other channels; no treatment is inferred.',
      color: SENSORS.temp.color,
    });
  }

  if (sleepDelta < -8) {
    concerns.push({
      id: 'concern-recovery',
      title: 'Recovery baseline deviation',
      deviation: `Sleep/recovery index is ${Math.abs(sleepDelta).toFixed(0)} points below the personal baseline.`,
      measurement: 'Sleep / recovery aggregate · activity index',
      interval: 'Most recent daily aggregate',
      severity: 'watch',
      confidence: Math.min(76, 40 + Math.abs(sleepDelta) * 1.4),
      witnesses: [],
      nextStep:
        'Track the next sleep aggregate and daytime activity. Keep the recommendation monitoring-oriented; do not infer a sleep disorder.',
      color: SENSORS.sleep.color,
    });
  }

  if (concerns.length === 0) {
    concerns.push({
      id: 'concern-clear',
      title: 'No baseline anomaly detected',
      deviation: 'All four reconstruction windows remain inside the personal mean + 2σ band.',
      measurement: 'HRV · SpO₂ · skin temperature · recovery',
      interval: 'Current 30–240 s window set',
      severity: 'clear',
      confidence: 92,
      witnesses: [],
      nextStep:
        'Maintain routine multi-window monitoring. Confirm sensor contact at the next scheduled check and keep the personal baseline current.',
      color: SENSORS.hrv.color,
    });
  }

  return (
    <Panel
      id="potential-concerns"
      bracket
      eyebrow="Screening flags and monitoring guidance"
      title="Potential Concerns & Recommendations"
      actions={<Badge tone={concerns.some((concern) => concern.severity === 'monitor') ? 'red' : concerns.some((concern) => concern.severity === 'watch') ? 'amber' : 'green'} dot>{concerns.length} item{concerns.length === 1 ? '' : 's'}</Badge>}
      className="h-full"
      bodyClassName="p-3"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8.5px] uppercase tracking-micro text-muted">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={10} className="text-green" /> Monitoring recommendations only
          </span>
          <span>No diagnosis · no treatment</span>
        </div>
      }
    >
      <div className="space-y-2">
        {concerns.map((concern) => (
          <article
            key={concern.id}
            className="rounded-md border border-line-soft bg-base/30 p-2.5"
            style={{ borderLeftColor: concern.color, borderLeftWidth: 2 }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-base/60">
                  {concern.severity === 'clear' ? (
                    <CheckCircle2 size={12} className="text-green" />
                  ) : concern.severity === 'watch' ? (
                    <Eye size={12} className="text-amber" />
                  ) : (
                    <AlertTriangle size={12} className="text-red" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[11px] font-medium leading-tight text-ink">{concern.title}</h3>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{concern.deviation}</p>
                </div>
              </div>
              <Badge tone={SEVERITY_TONE[concern.severity]} className="shrink-0 !text-[7.5px]">
                {concern.severity}
              </Badge>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[8.5px]">
              <div>
                <div className="font-mono text-[7.5px] uppercase tracking-micro text-muted/70">Affected measurement</div>
                <div className="mt-0.5 text-[9px] text-ink">{concern.measurement}</div>
              </div>
              <div>
                <div className="font-mono text-[7.5px] uppercase tracking-micro text-muted/70">Relevant interval</div>
                <div className="mt-0.5 text-[9px] text-ink">{concern.interval}</div>
              </div>
              <div>
                <div className="font-mono text-[7.5px] uppercase tracking-micro text-muted/70">Confidence</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-base">
                    <div className="h-full rounded-full" style={{ width: `${concern.confidence}%`, background: concern.color }} />
                  </div>
                  <span className="font-mono text-[8px] tabular-nums text-ink">{concern.confidence}%</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[7.5px] uppercase tracking-micro text-muted/70">Witness channels</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {concern.witnesses.length ? (
                    concern.witnesses.map((id) => (
                      <span key={id} className="rounded border border-line px-1 font-mono text-[7px] uppercase tracking-micro text-muted">
                        {WITNESS_LABEL[id]}
                      </span>
                    ))
                  ) : (
                    <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted/70">none co-affected</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 rounded border border-line-soft bg-base/40 px-2 py-1.5">
              <div className="font-mono text-[7.5px] uppercase tracking-micro text-cyan">Suggested next step</div>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">{concern.nextStep}</p>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
