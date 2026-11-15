import { Sparkline } from '@/components/charts/Sparkline';
import { Badge, CHANNEL_TONE } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SENSORS, SENSOR_ORDER } from '@/lib/sensors';
import type { PhysiologicalBaseline, SensorId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const BASELINE_KEY: Record<SensorId, keyof PhysiologicalBaseline> = {
  hr: 'hr',
  hrv: 'hrv',
  spo2: 'spo2',
  temp: 'temp',
  activity: 'activity',
  sleep: 'sleep',
};

const STATUS_LABEL = { normal: 'within baseline', anomaly: 'deviation', nodata: 'no data' } as const;

export function MeasurementOverview() {
  const { snapshot } = useTelemetry();
  const baseline = snapshot.astronaut.baseline;

  return (
    <Panel
      bracket
      eyebrow="Supporting measurements · personal baseline comparison"
      title="Measurement Context"
      actions={<Badge tone="neutral">{SENSOR_ORDER.length} channels</Badge>}
      className="h-full"
      bodyClassName="p-0"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-micro text-muted">
          <span>Baseline · {snapshot.astronaut.baselineDays}d · {snapshot.astronaut.baselineWindows.toLocaleString()} windows</span>
          <Link to="/sensor-intelligence" className="flex items-center gap-1 text-cyan hover:underline">
            Channel detail <ArrowUpRight size={10} />
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-px bg-line-soft sm:grid-cols-2 xl:grid-cols-1">
        {SENSOR_ORDER.map((id) => {
          const sensor = snapshot.sensors.find((entry) => entry.id === id);
          if (!sensor) return null;
          const meta = SENSORS[id];
          const base = baseline[BASELINE_KEY[id]];
          const value = sensor.value;
          const deviation = value - base;
          const decimals = meta.decimals;
          const significant = Math.abs(deviation) >= (id === 'temp' ? 0.25 : id === 'spo2' ? 0.8 : id === 'hr' ? 8 : id === 'hrv' ? 6 : id === 'sleep' ? 8 : 12);
          return (
            <div key={id} className="flex items-center gap-3 bg-panel px-3 py-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[8px] uppercase tracking-micro text-muted">{meta.short} · {meta.label}</span>
                  <Badge tone={CHANNEL_TONE[sensor.status]} className="!px-1 !py-0 !text-[7px]">
                    {STATUS_LABEL[sensor.status]}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-[15px] leading-none tabular-nums text-ink">
                    {value.toFixed(decimals)}
                  </span>
                  <span className="font-mono text-[8px] text-muted">{sensor.unit}</span>
                  <span className={cn('ml-auto font-mono text-[8.5px] tabular-nums', significant ? 'text-amber' : 'text-muted')}>
                    {deviation >= 0 ? '+' : '−'}{Math.abs(deviation).toFixed(decimals)} vs base
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted/60">
                    base {base} {sensor.unit}
                  </span>
                  <span className="w-16 shrink-0">
                    <Sparkline data={sensor.trend} color={meta.color} height={16} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-line-soft px-3 py-2 font-mono text-[8px] uppercase tracking-micro text-muted/70">
        Measurements are inputs to the conclusions above; they are not diagnoses.
      </div>
    </Panel>
  );
}
