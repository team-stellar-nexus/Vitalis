import { RRTachogram } from '@/components/charts/MiniVisuals';
import { TrendChart } from '@/components/charts/TrendChart';
import { Waveform } from '@/components/charts/Waveform';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, CHANNEL_TONE, LiveDot } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { ExpandDialog } from '@/components/ui/ExpandDialog';
import { Panel } from '@/components/ui/Panel';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Segmented } from '@/components/ui/Segmented';
import { SENSORS } from '@/lib/sensors';
import type { SensorId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Maximize2, Pause, Play, RotateCcw, Signal } from 'lucide-react';
import { useMemo, useState } from 'react';

const STATUS_LABEL = { normal: 'NOMINAL', anomaly: 'ANOMALY', nodata: 'NO DATA' } as const;

function beatStats(rr: number[]) {
  if (rr.length < 2) return { sdnn: 0, rmssd: 0 };
  const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
  const variance = rr.reduce((a, b) => a + (b - mean) ** 2, 0) / rr.length;
  let diffSquares = 0;
  for (let i = 1; i < rr.length; i += 1) {
    diffSquares += (rr[i] - rr[i - 1]) ** 2;
  }
  return {
    sdnn: Math.sqrt(variance),
    rmssd: Math.sqrt(diffSquares / (rr.length - 1)),
  };
}

export function LiveMonitoring() {
  const { snapshot, pause, resume, reset } = useTelemetry();
  const { signal, vitals, paused, health } = snapshot;
  const [trendRange, setTrendRange] = useState<60 | 120 | 300>(300);
  const [ppgOpen, setPpgOpen] = useState(false);

  const hrvPoints = useMemo(() => {
    const last = signal.hrvTrend[signal.hrvTrend.length - 1]?.t ?? 0;
    return signal.hrvTrend.filter((point) => point.t >= last - trendRange);
  }, [signal.hrvTrend, trendRange]);

  const spo2Points = useMemo(() => {
    const last = signal.spo2Trend[signal.spo2Trend.length - 1]?.t ?? 0;
    return signal.spo2Trend.filter((point) => point.t >= last - trendRange);
  }, [signal.spo2Trend, trendRange]);

  const maxHrv = hrvPoints[hrvPoints.length - 1]?.t ?? 0;
  const maxSpo2 = spo2Points[spo2Points.length - 1]?.t ?? 0;
  const { sdnn, rmssd } = beatStats(signal.rrIntervals);

  return (
    <div>
      <PageHeader
        eyebrow="Real-time acquisition · full-resolution telemetry"
        title="Live Monitoring"
        description="Continuous PPG, derived heart-rate, HRV and SpO₂ streams with per-channel signal status. Buffer and inference clock are controlled by the operator."
        actions={
          <>
            <Segmented<60 | 120 | 300>
              label="Trend time range"
              options={[
                { value: 60, label: '60s' },
                { value: 120, label: '2m' },
                { value: 300, label: '5m' },
              ]}
              value={trendRange}
              onChange={(value) => setTrendRange(value)}
            />
            <Badge tone={paused ? 'amber' : 'green'} dot pulse={!paused}>
              {paused ? 'BUFFER HELD' : 'STREAM ACTIVE'}
            </Badge>
            <Button size="sm" variant="outline" onClick={paused ? resume : pause}>
              {paused ? <Play size={12} /> : <Pause size={12} />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw size={12} /> Reset
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            bracket
            eyebrow="Photoplethysmography · optical blood-volume"
            title="PPG Waveform"
            actions={
              <>
                <Badge tone="neutral" className="!text-[8px]">10 s · 50 Hz</Badge>
                <Badge tone="cyan" dot pulse={!paused}>{paused ? 'HELD' : 'LIVE'}</Badge>
                <IconButton label="Expand PPG view" onClick={() => setPpgOpen(true)}>
                  <Maximize2 size={13} />
                </IconButton>
              </>
            }
            bodyClassName="p-3"
          >
            <div className="relative rounded border border-line-soft bg-base/40 p-2">
              <Waveform
                points={signal.ppg}
                color={SENSORS.hr.color}
                height={248}
                showScan={!paused}
                ariaLabel="PPG waveform, ten second window"
              />
              <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-micro text-muted/70">
                <span>−10.0 s</span>
                <span>−7.5 s</span>
                <span>−5.0 s</span>
                <span>−2.5 s</span>
                <span>0.0 s</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Heart rate" value={vitals.hr} unit="BPM" color="#35D9F2" decimals={0} />
              <Readout label="Beat interval" value={Math.round(60000 / vitals.hr)} unit="ms" color="#438AFF" decimals={0} />
              <Readout label="Perfusion index" value={snapshot.sensors[0]?.quality ?? 98} unit="%" color="#35D49A" decimals={0} />
              <Readout label="Signal-to-noise" value={28 + Math.round(snapshot.anomaly.score / 8)} unit="dB" color="#9675FF" decimals={0} />
            </div>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-4">
          <Panel
            bracket
            eyebrow="Physiological readouts"
            title="Live Vitals"
            className="h-full"
            bodyClassName="p-0"
            footer={
              <span className="flex items-center justify-between font-mono text-[9px] text-muted">
                <span>UI 1 Hz · simulated buffer</span>
                <span>{health.sampleRateHz} Hz acquisition</span>
              </span>
            }
          >
            <div className="divide-y divide-line-soft">
              {snapshot.sensors.slice(0, 4).map((sensor) => {
                const meta = SENSORS[sensor.id as SensorId];
                return (
                  <div key={sensor.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                        <span className="label-xs">{sensor.label}</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <AnimatedNumber
                          value={sensor.value}
                          decimals={meta.decimals}
                          className="font-mono text-[24px] leading-none tabular-nums text-ink"
                        />
                        <span className="font-mono text-[10px] text-muted">{sensor.unit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone={CHANNEL_TONE[sensor.status]} dot={sensor.status === 'normal'} className="!text-[8px]">
                        {STATUS_LABEL[sensor.status]}
                      </Badge>
                      <div className="mt-1.5 font-mono text-[8.5px] text-muted">Q {sensor.quality}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        <Panel eyebrow="Derived cardiac shape" title="Heart Rate Waveform" bodyClassName="p-3">
          <Waveform points={signal.ecg} color="#438AFF" height={132} showZeroLine ariaLabel="Derived ECG waveform" />
          <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-micro text-muted">
            <span>−6 s</span>
            <span>{vitals.hr} BPM</span>
            <span>0 s</span>
          </div>
        </Panel>

        <Panel eyebrow={`${trendRange} s rolling · RMSSD`} title="HRV Trend" bodyClassName="p-3">
          <TrendChart
            data={hrvPoints as unknown as Array<Record<string, number>>}
            series={[{ key: 'v', label: 'HRV', color: '#9675FF', unit: 'ms', type: 'area' }]}
            height={132}
            tickFormatter={(v) => `${Math.round(v - maxHrv)}s`}
            tooltipLabel={(v) => `T${Math.round(v - maxHrv)}s`}
            tooltipDecimals={0}
          />
        </Panel>

        <Panel eyebrow={`${trendRange} s rolling · oxygen saturation`} title="SpO₂ Trend" bodyClassName="p-3">
          <TrendChart
            data={spo2Points as unknown as Array<Record<string, number>>}
            series={[{ key: 'v', label: 'SpO₂', color: '#438AFF', unit: '%', type: 'area' }]}
            height={132}
            yDomain={[92, 100]}
            tickFormatter={(v) => `${Math.round(v - maxSpo2)}s`}
            tooltipLabel={(v) => `T${Math.round(v - maxSpo2)}s`}
            tooltipDecimals={1}
          />
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Panel
            eyebrow="Transport and buffer health"
            title="Stream Integrity"
            actions={<Badge tone={health.link === 'nominal' ? 'green' : 'amber'} dot>{health.link}</Badge>}
            className="h-full"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StreamMetric label="Latency" value={`${health.latencyMs} ms`} pct={Math.min(100, health.latencyMs * 1.4)} tone="cyan" />
              <StreamMetric label="Packet loss" value={`${health.packetLossPct.toFixed(2)} %`} pct={health.packetLossPct * 30} tone="green" />
              <StreamMetric label="Buffer" value={`${health.bufferPct} %`} pct={health.bufferPct} tone="blue" />
              <StreamMetric label="Sample rate" value={`${health.sampleRateHz} Hz`} pct={62} tone="violet" />
              <StreamMetric label="Channels" value={`${health.channelsOnline}/${health.channelsTotal}`} pct={(health.channelsOnline / health.channelsTotal) * 100} tone="green" />
              <StreamMetric label="Pack battery" value={`${health.batteryPct} %`} pct={health.batteryPct} tone="amber" />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Buffers are re-synchronised on resume. Latency, packet loss and battery are simulated
              transport values; no real wearable or ground link is connected.
            </p>
          </Panel>
        </div>

        <div className="min-w-0 xl:col-span-5">
          <Panel
            eyebrow="Per-channel connectivity"
            title="Sensor Status"
            className="h-full"
            bodyClassName="p-0"
            actions={<LiveDot tone="green" label="6 channels" />}
          >
            <div className="divide-y divide-line-soft">
              {snapshot.sensors.map((sensor) => (
                <div key={sensor.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-8 shrink-0 font-mono text-[9px] uppercase tracking-micro" style={{ color: SENSORS[sensor.id].color }}>
                    {sensor.shortLabel}
                  </span>
                  <span className="truncate text-[10.5px] text-muted">{sensor.label}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-ink">
                    {sensor.displayValue} <span className="text-[8px] text-muted">{sensor.unit}</span>
                  </span>
                  <Badge tone={CHANNEL_TONE[sensor.status]} className="!w-[62px] !justify-center !px-1 !text-[7.5px]">
                    {STATUS_LABEL[sensor.status]}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-line-soft px-3 py-2 font-mono text-[9px] uppercase tracking-micro text-muted">
              <Signal size={10} className="text-green" />
              Band-pass 0.5–8 Hz · baseline wander removed
            </div>
          </Panel>
        </div>
      </div>

      <ExpandDialog
        open={ppgOpen}
        onClose={() => setPpgOpen(false)}
        title="PPG waveform · expanded"
        subtitle="10 s buffer · 50 Hz · simulated optical channel"
      >
        <Waveform
          points={signal.ppg}
          color={SENSORS.hr.color}
          height={420}
          showScan={!paused}
          ariaLabel="Expanded PPG waveform, ten second window"
        />
        <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-micro text-muted/70">
          <span>−10.0 s</span>
          <span>−7.5 s</span>
          <span>−5.0 s</span>
          <span>−2.5 s</span>
          <span>0.0 s</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="Heart rate" value={vitals.hr} unit="BPM" color="#35D9F2" decimals={0} />
          <Readout label="Beat interval" value={Math.round(60000 / vitals.hr)} unit="ms" color="#438AFF" decimals={0} />
          <Readout label="RMSSD" value={Math.round(rmssd)} unit="ms" color="#9675FF" decimals={0} />
          <Readout label="SDNN" value={Math.round(sdnn)} unit="ms" color="#35D49A" decimals={0} />
        </div>
        <div className="mt-2 rounded border border-line-soft bg-base/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="label-xs">R-R tachogram · beat-to-beat</span>
            <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
              {signal.rrIntervals.length} beats · simulated
            </span>
          </div>
          <RRTachogram intervals={signal.rrIntervals} height={64} />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Beat-to-beat intervals are derived from simulated pulse timing. RMSSD and SDNN are computed
          from the same buffer and are not clinical measurements.
        </p>
      </ExpandDialog>
    </div>
  );
}

function Readout({
  label,
  value,
  unit,
  color,
  decimals,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  decimals: number;
}) {
  return (
    <div className="rounded border border-line-soft bg-base/40 px-2 py-1.5">
      <div className="font-mono text-[8px] uppercase tracking-micro text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          className="font-mono text-[15px] tabular-nums leading-none"
        />
        <span className="font-mono text-[8px]" style={{ color }}>{unit}</span>
      </div>
    </div>
  );
}

function StreamMetric({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: 'cyan' | 'green' | 'blue' | 'violet' | 'amber';
}) {
  const color =
    tone === 'cyan' ? 'bg-cyan' : tone === 'green' ? 'bg-green' : tone === 'blue' ? 'bg-blue' : tone === 'violet' ? 'bg-violet' : 'bg-amber';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[8.5px] uppercase tracking-micro text-muted">{label}</span>
        <span className="font-mono text-[10.5px] tabular-nums text-ink">{value}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-base">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
