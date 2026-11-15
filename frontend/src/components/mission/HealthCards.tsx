import { Sparkline } from '@/components/charts/Sparkline';
import { ActivityBars, NightBars, RRTachogram } from '@/components/charts/MiniVisuals';
import { Waveform } from '@/components/charts/Waveform';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { SENSORS } from '@/lib/sensors';
import type { SensorId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Activity, HeartPulse, Moon, Thermometer, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const ICONS: Record<SensorId, LucideIcon> = {
  hr: HeartPulse,
  hrv: Activity,
  spo2: Wind,
  temp: Thermometer,
  activity: Zap,
  sleep: Moon,
};

const DESCRIPTOR: Record<SensorId, string> = {
  hr: 'Optical pulse rate',
  hrv: 'Beat-to-beat (R-R)',
  spo2: 'Oxygen saturation',
  temp: 'Skin thermistor',
  activity: 'Motion index',
  sleep: '7-night recovery',
};

const STATUS_LABEL = { normal: 'NOMINAL', anomaly: 'ANOMALY', nodata: 'NO DATA' } as const;

const STATUS_DOT = {
  normal: 'bg-green',
  anomaly: 'bg-red',
  nodata: 'bg-muted',
} as const;

function rmssd(rr: number[]) {
  if (rr.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < rr.length; i += 1) {
    const d = rr[i] - rr[i - 1];
    sum += d * d;
  }
  return Math.sqrt(sum / (rr.length - 1));
}

/** Section B — six health intelligence cards, each with a metric-specific trace. */
export function HealthCards() {
  const { snapshot } = useTelemetry();
  const rr = snapshot.signal.rrIntervals;
  const variability = Math.round(rmssd(rr));

  const sleepHistory = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    Math.max(30, Math.min(100, Math.round(snapshot.vitals.sleep + [-9, -4, -7, -2, -5, -1, 0][i]))),
  );
  const sleepMean = Math.round(sleepHistory.reduce((a, b) => a + b, 0) / sleepHistory.length);

  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {snapshot.sensors.map((sensor) => {
        const meta = SENSORS[sensor.id];
        const Icon = ICONS[sensor.id];
        const isLabel = sensor.id === 'activity';
        const trend = sensor.trend.slice(-24);
        const tempMin = Math.min(...trend) - 0.08;
        const tempMax = Math.max(...trend) + 0.08;

        const aux =
          sensor.id === 'hrv'
            ? `RMSSD ${variability} ms`
            : sensor.id === 'hr'
              ? `R-R ${Math.round(60000 / sensor.value)} ms`
              : sensor.id === 'spo2'
                ? `Q ${sensor.quality}% · 25 Hz`
                : sensor.id === 'temp'
                  ? `Q ${sensor.quality}% · ±0.02°C`
                  : sensor.id === 'activity'
                    ? `IDX ${Math.round(sensor.value)} / 100`
                    : `7N MEAN ${sleepMean}`;

        let visual: React.ReactNode;
        switch (sensor.id) {
          case 'hr':
            visual = (
              <Waveform
                points={snapshot.signal.ecg.slice(-260)}
                color={meta.color}
                height={44}
                fill={false}
                showScan={false}
                ariaLabel="Derived cardiac waveform"
              />
            );
            break;
          case 'hrv':
            visual = <RRTachogram intervals={rr} color={meta.color} height={44} />;
            break;
          case 'spo2':
            visual = (
              <Sparkline
                data={trend}
                color={meta.color}
                height={44}
                min={94}
                max={100}
                band={[95, 100]}
              />
            );
            break;
          case 'temp':
            visual = (
              <Sparkline
                data={trend}
                color={meta.color}
                height={44}
                min={tempMin}
                max={tempMax}
                band={[36.1, 37.2]}
              />
            );
            break;
          case 'activity':
            visual = <ActivityBars data={sensor.trend.slice(-14)} color={meta.color} height={44} />;
            break;
          default:
            visual = <NightBars values={sleepHistory} color={meta.color} height={44} />;
        }

        return (
          <Link
            key={sensor.id}
            to="/sensor-intelligence"
            title={`${sensor.label} — open sensor intelligence`}
            aria-label={`${sensor.label}, ${sensor.displayValue} ${sensor.unit}. Open sensor intelligence.`}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-line card-surface inner-hairline p-3 transition-all duration-200 hover:border-cyan/35 hover:shadow-[0_0_28px_-16px_rgba(53,217,242,0.5)]"
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1.5" style={{ color: meta.color }}>
                <Icon size={12} className="shrink-0" />
                <span className="truncate font-mono text-[9px] font-medium uppercase tracking-micro text-muted">
                  {meta.short}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[7px] uppercase tracking-micro text-muted/60">SIM</span>
            </div>

            <div className="mt-1.5 flex h-[30px] items-baseline gap-1 overflow-hidden">
              {isLabel ? (
                <span className="truncate font-mono text-[20px] font-medium leading-none tracking-tight text-ink">
                  {sensor.displayValue}
                </span>
              ) : (
                <>
                  <AnimatedNumber
                    value={sensor.value}
                    decimals={meta.decimals}
                    className="font-mono text-[24px] font-medium leading-none tracking-tight text-ink"
                  />
                  <span className="font-mono text-[10px] text-muted">{sensor.unit}</span>
                </>
              )}
              {isLabel && <span className="font-mono text-[9px] text-muted">{sensor.unit}</span>}
            </div>

            <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
              <span className="truncate text-[9.5px] text-muted">{DESCRIPTOR[sensor.id]}</span>
              <span className="shrink-0 font-mono text-[8px] tabular-nums text-muted/70">
                {sensor.id === 'hrv' ? 'R-R' : sensor.id === 'sleep' ? '7N' : meta.source.split('·')[0]}
              </span>
            </div>

            <div className="mt-2 flex h-[44px] items-center">{visual}</div>

            <div className="mt-auto flex items-center justify-between gap-1 border-t border-line-soft pt-1.5 font-mono text-[8px] uppercase tracking-micro text-muted">
              <span className="flex shrink-0 items-center gap-1">
                <span className={cn('h-1 w-1 rounded-full', STATUS_DOT[sensor.status])} />
                {STATUS_LABEL[sensor.status]}
              </span>
              <span className="truncate text-right text-muted/80">{aux}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
