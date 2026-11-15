import { Sparkline } from '@/components/charts/Sparkline';
import { TrendChart } from '@/components/charts/TrendChart';
import { WitnessPanel } from '@/components/mission/WitnessPanel';
import { HumanBodyIntelligence } from '@/components/mission/HumanBodyIntelligence';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, CHANNEL_TONE } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/lib/hooks';
import { SENSORS, SENSOR_ORDER } from '@/lib/sensors';
import type { SensorId } from '@/lib/types';
import { cn, relativeTime } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { useState } from 'react';

const STATUS_LABEL = { normal: 'NOMINAL', anomaly: 'ANOMALY', nodata: 'NO DATA' } as const;

export function SensorIntelligence() {
  const { snapshot } = useTelemetry();
  const now = useNow(5000);
  const [selected, setSelected] = useState<SensorId>('hr');
  const meta = SENSORS[selected];
  const history = snapshot.history as unknown as Array<Record<string, number>>;
  const latest = snapshot.history[snapshot.history.length - 1];
  const maxT = latest?.t ?? 0;
  const avgQuality =
    snapshot.sensors.reduce((a, s) => a + s.quality, 0) / Math.max(1, snapshot.sensors.length);

  return (
    <div>
      <PageHeader
        eyebrow="Channel inventory · acquisition quality"
        title="Sensor Intelligence"
        description="Per-channel health, connectivity and signal quality for the wearable pack. Quality values are simulated transport estimates, not calibration certificates."
        actions={
          <>
            <Badge tone="green" dot pulse>
              {snapshot.health.channelsOnline}/{snapshot.health.channelsTotal} ONLINE
            </Badge>
            <Badge tone="neutral">Q̄ {avgQuality.toFixed(0)}%</Badge>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.sensors.map((sensor) => {
          const m = SENSORS[sensor.id];
          return (
            <Panel
              key={sensor.id}
              bodyClassName="p-3"
              className={cn(
                'transition-colors',
                sensor.status === 'anomaly' && 'border-red/40',
                selected === sensor.id && 'border-cyan/40',
              )}
              bracket={sensor.status === 'anomaly'}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(sensor.id)}
                  className="min-w-0 text-left"
                  title={`Chart ${sensor.label}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                    <span className="text-[11px] font-medium text-ink">{sensor.label}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[8px] uppercase tracking-micro text-muted">
                    {sensor.source} · {m.normalRange[0]}–{m.normalRange[1]} {m.unit}
                  </div>
                </button>
                <Badge tone={CHANNEL_TONE[sensor.status]} className="shrink-0 !text-[8px]">
                  {STATUS_LABEL[sensor.status]}
                </Badge>
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-[22px] leading-none tabular-nums text-ink">
                    {sensor.displayValue}
                  </span>
                  <span className="font-mono text-[9px] text-muted">{sensor.unit}</span>
                </div>
                <div className="w-24 shrink-0">
                  <Sparkline data={sensor.trend} color={m.color} height={26} />
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-micro text-muted">
                  <span>Signal quality</span>
                  <span className={sensor.quality < 80 ? 'text-amber' : 'text-ink'}>{sensor.quality}%</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-base">
                  <div
                    className={cn('h-full rounded-full', sensor.quality < 80 ? 'bg-amber' : 'bg-green')}
                    style={{ width: `${Math.max(2, sensor.quality)}%` }}
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-1.5 font-mono text-[8.5px] text-muted">
                <span>SYNC {relativeTime(sensor.updatedAt, now)}</span>
                <button
                  type="button"
                  onClick={() => setSelected(sensor.id)}
                  className="uppercase tracking-micro text-cyan/80 hover:text-cyan hover:underline"
                >
                  inspect
                </button>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            bracket
            eyebrow={`${meta.label} · 300 s rolling history`}
            title="Historical Readings"
            actions={
              <Segmented
                label="Sensor"
                options={SENSOR_ORDER.map((id) => ({ value: id, label: SENSORS[id].short }))}
                value={selected}
                onChange={(v) => setSelected(v as SensorId)}
              />
            }
            bodyClassName="p-3"
            footer={
              <span className="flex flex-wrap justify-between gap-2 font-mono text-[9px] uppercase tracking-micro text-muted">
                <span>Source · {meta.source}</span>
                <span>
                  Current {snapshot.sensors.find((s) => s.id === selected)?.displayValue ?? '—'} {meta.unit}
                </span>
              </span>
            }
          >
            <TrendChart
              data={history}
              series={[
                {
                  key: selected,
                  label: meta.label,
                  color: meta.color,
                  unit: meta.unit,
                  type: 'area',
                },
              ]}
              height={300}
              yDomain={
                selected === 'spo2' ? [92, 100] : selected === 'temp' ? [36.2, 37.4] : ['auto', 'auto']
              }
              tickFormatter={(v) => `${Math.round(v - maxT)}s`}
              tooltipLabel={(v) => `T${Math.round(v - maxT)}s`}
              tooltipDecimals={meta.decimals}
            />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[8.5px] uppercase tracking-micro text-muted">
              <span>Window {snapshot.history.length}s</span>
              <span>Normal range {meta.normalRange[0]}–{meta.normalRange[1]} {meta.unit}</span>
              <span className="text-muted/60">Simulated values</span>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <Panel
            eyebrow="Acquisition pipeline"
            title="Data Quality"
            className="h-full"
            bodyClassName="p-0"
            footer={
              <span className="font-mono text-[9px] leading-relaxed text-muted">
                Quality reflects simulated SNR, dropout and buffer continuity.
              </span>
            }
          >
            <div className="divide-y divide-line-soft">
              {snapshot.sensors.map((sensor) => (
                <div key={sensor.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                      {sensor.shortLabel}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-ink">{sensor.quality}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-base">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        sensor.status === 'nodata'
                          ? 'bg-muted/40'
                          : sensor.quality < 85
                            ? 'bg-amber'
                            : 'bg-cyan/80',
                      )}
                      style={{ width: `${Math.max(2, sensor.quality)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-px bg-line-soft">
                {[
                  ['Sample rate', `${snapshot.health.sampleRateHz} Hz`],
                  ['Packet loss', `${snapshot.health.packetLossPct.toFixed(2)}%`],
                  ['Buffer', `${snapshot.health.bufferPct}%`],
                  ['Battery', `${snapshot.health.batteryPct}%`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-panel px-3 py-2">
                    <div className="font-mono text-[8px] uppercase tracking-micro text-muted">{label}</div>
                    <div className="mt-0.5 font-mono text-[12px] text-ink">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mb-3">
        <HumanBodyIntelligence />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel
            bracket
            eyebrow="Channel inventory · wearable pack"
            title="Connectivity"
            bodyClassName="p-0"
            actions={<Badge tone={snapshot.health.link === 'nominal' ? 'green' : 'amber'} dot>{snapshot.health.link}</Badge>}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line bg-base/40">
                    {['Channel', 'Source', 'Rate', 'Quality', 'Status', 'Last sync'].map((h) => (
                      <th key={h} className="px-3 py-2 font-mono text-[8px] uppercase tracking-micro text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.sensors.map((sensor) => (
                    <tr key={sensor.id} className="border-b border-line-soft/70 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-ink">{sensor.shortLabel}</span>
                        <span className="ml-2 text-[10px] text-muted">{sensor.label}</span>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted">{sensor.source}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted">
                        {sensor.id === 'sleep' ? 'daily' : '25 Hz'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] tabular-nums text-ink">{sensor.quality}%</td>
                      <td className="px-3 py-2">
                        <Badge tone={CHANNEL_TONE[sensor.status]} className="!text-[8px]">
                          {STATUS_LABEL[sensor.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-[9px] text-muted">
                        {sensor.status === 'nodata' ? 'daily aggregate' : relativeTime(sensor.updatedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-5">
          <WitnessPanel compact />
        </div>
      </div>
    </div>
  );
}
