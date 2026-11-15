import { TrendChart } from '@/components/charts/TrendChart';
import { Waveform } from '@/components/charts/Waveform';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Section F — live PPG / ECG / HRV / SpO₂ preview with transport controls. */
export function LiveSignalPanel() {
  const { snapshot, pause, resume, reset } = useTelemetry();
  const { signal, paused } = snapshot;
  const lastHrv = signal.hrvTrend[signal.hrvTrend.length - 1];
  const lastSpo2 = signal.spo2Trend[signal.spo2Trend.length - 1];
  const maxT = signal.hrvTrend[signal.hrvTrend.length - 1]?.t ?? 0;
  const maxS = signal.spo2Trend[signal.spo2Trend.length - 1]?.t ?? 0;

  return (
    <Panel
      bracket
      eyebrow="Continuous acquisition · band-pass 0.5–8 Hz"
      title="Live Signal Monitoring"
      actions={
        <>
          <Badge tone={paused ? 'amber' : 'green'} dot pulse={!paused}>
            {paused ? 'PAUSED' : 'STREAMING'}
          </Badge>
          <IconButton
            label={paused ? 'Resume telemetry' : 'Pause telemetry'}
            onClick={paused ? resume : pause}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </IconButton>
          <IconButton label="Reset simulation buffers" onClick={reset}>
            <RotateCcw size={13} />
          </IconButton>
          <Link
            to="/live-monitoring"
            className="hidden items-center gap-1 font-mono text-[9px] uppercase tracking-micro text-cyan hover:underline sm:flex"
          >
            Full view <ArrowUpRight size={10} />
          </Link>
        </>
      }
      bodyClassName="p-3"
    >
      <div className="grid gap-2.5 lg:grid-cols-2">
        <SignalCell
          title="PPG waveform"
          meta="10 s · 50 Hz · optical"
          value={`${snapshot.vitals.hr} BPM`}
          color="#35D9F2"
        >
          <Waveform points={signal.ppg} color="#35D9F2" height={104} ariaLabel="PPG waveform" />
        </SignalCell>

        <SignalCell
          title="Heart rate waveform"
          meta="6 s · derived ECG shape"
          value={`${snapshot.vitals.hr} BPM`}
          color="#438AFF"
        >
          <Waveform points={signal.ecg} color="#438AFF" height={104} showZeroLine ariaLabel="ECG waveform" />
        </SignalCell>

        <SignalCell
          title="HRV trend"
          meta="300 s rolling · RMSSD"
          value={`${snapshot.vitals.hrv} ms`}
          color="#9675FF"
        >
          <TrendChart
            data={signal.hrvTrend as unknown as Array<Record<string, number>>}
            series={[{ key: 'v', label: 'HRV', color: '#9675FF', unit: 'ms', type: 'area' }]}
            height={96}
            tickFormatter={(v) => `${Math.round(v - maxT)}s`}
            tooltipLabel={(v) => `T${Math.round(v - maxT)}s`}
            tooltipDecimals={0}
          />
        </SignalCell>

        <SignalCell
          title="SpO₂ trend"
          meta="300 s rolling · %"
          value={`${lastSpo2?.v?.toFixed(1) ?? snapshot.vitals.spo2} %`}
          color="#438AFF"
        >
          <TrendChart
            data={signal.spo2Trend as unknown as Array<Record<string, number>>}
            series={[{ key: 'v', label: 'SpO₂', color: '#438AFF', unit: '%', type: 'area' }]}
            height={96}
            yDomain={[92, 100]}
            tickFormatter={(v) => `${Math.round(v - maxS)}s`}
            tooltipLabel={(v) => `T${Math.round(v - maxS)}s`}
            tooltipDecimals={1}
          />
        </SignalCell>
      </div>
      {lastHrv && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2 font-mono text-[9px] uppercase tracking-micro text-muted">
          <span>Latest sample · HRV {lastHrv.v.toFixed(0)} ms · SpO₂ {lastSpo2?.v.toFixed(1)} %</span>
          <span>{snapshot.health.channelsOnline}/6 channels · {snapshot.health.sampleRateHz} Hz</span>
        </div>
      )}
    </Panel>
  );
}

function SignalCell({
  title,
  meta,
  value,
  color,
  children,
}: {
  title: string;
  meta: string;
  value: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-base/30 p-2.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            <span className="truncate text-[11px] font-medium text-ink">{title}</span>
          </div>
          <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-micro text-muted">{meta}</div>
        </div>
        <span className="shrink-0 font-mono text-[12px] tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
