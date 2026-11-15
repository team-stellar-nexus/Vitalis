import { SignalPlot, type PlotInterval, type PlotMarker, type PlotSeries } from '@/components/charts/SignalPlot';
import { Panel } from '@/components/ui/Panel';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  buildAnomalyIntervals,
  buildAnomalyMarkers,
  buildSignalWindow,
  SIGNAL_CHANNEL_META,
  type ObservatoryChannel,
} from '@/lib/observatory';
import type { SignalPoint, WindowSeconds } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Activity, ArrowUpRight, AudioWaveform, Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type SignalView = 'raw' | 'processed' | 'analyzed';
type Zoom = 1 | 2 | 4;

const zeroLine = (points: SignalPoint[]): SignalPoint[] => points.map((point) => ({ t: point.t, v: 0 }));

/**
 * Section B — the primary LIGO-inspired signal observatory.
 *
 * Every chart is built from the active profile's live simulation buffer. No
 * decorative heartbeat animation stands in for the waveform: the raw PPG, HRV
 * history, baseline, residual and smoothed residual are real arrays.
 */
export function SignalObservatory() {
  const { snapshot } = useTelemetry();
  const paused = snapshot.paused;
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ObservatoryChannel>('ppg');
  const [range, setRange] = useState<WindowSeconds>(120);
  const [view, setView] = useState<SignalView>('processed');
  const [zoom, setZoom] = useState<Zoom>(1);
  const [pan, setPan] = useState(0);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ channel?: ObservatoryChannel; range?: WindowSeconds }>).detail;
      if (!detail) return;
      if (detail.channel) setChannel(detail.channel);
      if (detail.range) setRange(detail.range);
      setView('processed');
      setZoom(1);
      setPan(0);
    };
    window.addEventListener('nexus:inspect-evidence', handler as EventListener);
    return () => window.removeEventListener('nexus:inspect-evidence', handler as EventListener);
  }, []);

  const bucket = Math.floor(snapshot.simTime / 2);
  const data = useMemo(
    () => buildSignalWindow(snapshot, channel, range),
    // Recompute on the 2-second simulation bucket, not every React render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot.astronaut.profileId, channel, range, bucket],
  );

  const viewSpan = range / zoom;
  const maxPan = range - viewSpan;
  const viewEnd = -pan * maxPan;

  const shifted = useMemo(() => {
    const shift = (points: SignalPoint[]) =>
      points
        .map((point) => ({ t: Number((point.t - viewEnd).toFixed(3)), v: point.v }))
        .filter((point) => point.t >= -viewSpan && point.t <= 0.01);
    return {
      raw: shift(data.raw),
      baseline: shift(data.baseline),
      processed: shift(data.processed),
      analyzed: shift(data.analyzed),
    };
  }, [data, viewEnd, viewSpan]);

  const intervals = useMemo<PlotInterval[]>(() => {
    return buildAnomalyIntervals(snapshot, range)
      .map((interval) => ({
        ...interval,
        start: interval.start - viewEnd,
        end: interval.end - viewEnd,
      }))
      .filter((interval) => interval.end >= -viewSpan && interval.start <= 0);
  }, [snapshot, range, viewEnd, viewSpan]);

  const markers = useMemo<PlotMarker[]>(() => {
    return buildAnomalyMarkers(snapshot, snapshot.anomaly.log, range)
      .map((marker) => ({ ...marker, t: marker.t - viewEnd }))
      .filter((marker) => marker.t >= -viewSpan && marker.t <= 0);
  }, [snapshot, range, viewEnd, viewSpan]);

  const plotSeries = useMemo<PlotSeries[]>(() => {
    const baseline =
      view === 'raw'
        ? { key: 'baseline', label: 'Personal baseline', color: '#438AFF', points: shifted.baseline, dashed: true, width: 1.1, opacity: 0.8 }
        : { key: 'baseline', label: 'Baseline reference', color: '#438AFF', points: zeroLine(shifted.processed), dashed: true, width: 1, opacity: 0.65 };
    if (view === 'raw') {
      return [
        baseline,
        { key: 'raw', label: 'Raw signal', color: SIGNAL_CHANNEL_META[channel].color, points: shifted.raw, width: 1.15, opacity: 0.9 },
      ];
    }
    if (view === 'analyzed') {
      return [
        baseline,
        { key: 'analyzed', label: 'Analyzed residual', color: '#9675FF', points: shifted.analyzed, width: 1.6 },
      ];
    }
    return [
      baseline,
      { key: 'processed', label: 'Processed residual', color: SIGNAL_CHANNEL_META[channel].color, points: shifted.processed, width: 1.6 },
    ];
  }, [channel, shifted, view]);

  const flagged = snapshot.windows.filter((window) => window.flagged).length;
  const windowRail = snapshot.windows.map((window) => (
    <div key={window.windowSeconds} className="min-w-0 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] text-muted">{window.windowSeconds}s</span>
        <span
          className={cn(
            'font-mono text-[8px] uppercase tracking-micro',
            window.flagged ? 'text-amber' : 'text-green',
          )}
        >
          {window.flagged ? 'flagged' : 'nominal'}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn('font-mono text-[14px] tabular-nums', window.flagged ? 'text-amber' : 'text-ink')}>
          {window.reconstructionError.toFixed(4)}
        </span>
        <span className="font-mono text-[8px] text-muted">/ {window.threshold.toFixed(4)}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-base">
        <div
          className={cn('h-full rounded-full', window.flagged ? 'bg-amber' : 'bg-green/70')}
          style={{ width: `${Math.min(100, (window.ratio / 2) * 100)}%` }}
        />
      </div>
    </div>
  ));

  return (
    <section id="signal-observatory" className="mb-3 scroll-mt-3">
      <Panel
        bracket
        flush
        eyebrow="LIGO-inspired signal observatory · raw → processed → analyzed"
        title="Time-series waveform and anomaly evidence"
        actions={
          <>
            <Badge tone={paused ? 'amber' : 'green'} dot pulse={!paused}>
              {paused ? 'buffer held' : 'stream active'}
            </Badge>
            <StatusBadge status={snapshot.anomaly.status} />
            <Button size="sm" variant="ghost" onClick={() => navigate('/signal-analysis')}>
              Full signal lab <ArrowUpRight size={11} />
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
          <Segmented<ObservatoryChannel>
            label="Signal channel"
            options={[
              { value: 'ppg', label: 'PPG', title: 'Photoplethysmography' },
              { value: 'hrv', label: 'HRV', title: 'R-R derived variability' },
            ]}
            value={channel}
            onChange={(value) => {
              setChannel(value);
              setPan(0);
            }}
          />
          <span className="h-4 w-px bg-line" />
          <Segmented<WindowSeconds>
            label="Analysis window"
            options={[
              { value: 30, label: '30s' },
              { value: 60, label: '60s' },
              { value: 120, label: '120s' },
              { value: 240, label: '240s' },
            ]}
            value={range}
            onChange={(value) => {
              setRange(value);
              setPan(0);
            }}
          />
          <span className="h-4 w-px bg-line" />
          <Segmented<SignalView>
            label="Signal stage"
            options={[
              { value: 'raw', label: 'Raw' },
              { value: 'processed', label: 'Processed' },
              { value: 'analyzed', label: 'Analyzed' },
            ]}
            value={view}
            onChange={setView}
          />
          <div className="ml-auto flex items-center gap-2">
            <Segmented<Zoom>
              label="Zoom"
              options={[
                { value: 1, label: '1×' },
                { value: 2, label: '2×' },
                { value: 4, label: '4×' },
              ]}
              value={zoom}
              onChange={(value) => {
                setZoom(value);
                setPan(0);
              }}
            />
            <span className="hidden font-mono text-[8px] uppercase tracking-micro text-muted sm:inline">
              {viewSpan}s span
            </span>
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8.5px] uppercase tracking-micro text-muted">
              {view === 'raw' ? (
                <>
                  <Legend color={SIGNAL_CHANNEL_META[channel].color} label="raw" />
                  <Legend color="#438AFF" label="personal baseline" dashed />
                </>
              ) : view === 'processed' ? (
                <>
                  <Legend color={SIGNAL_CHANNEL_META[channel].color} label="processed residual" />
                  <Legend color="#438AFF" label="baseline reference" dashed />
                </>
              ) : (
                <>
                  <Legend color="#9675FF" label="analyzed residual" />
                  <Legend color="#438AFF" label="baseline reference" dashed />
                </>
              )}
              <span className="text-muted/60">{data.sampleRateHz} Hz</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
                {intervals.length ? 'deviation highlighted' : 'no active deviation'}
              </span>
              <span className="h-1 w-1 rounded-full bg-cyan" />
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted/60">
                synthetic arrays
              </span>
            </div>
          </div>

          <SignalPlot
            series={plotSeries}
            range={viewSpan}
            endOffset={viewEnd}
            unit={data.unit}
            yLabel={
              view === 'raw'
                ? `${channel === 'ppg' ? 'PPG' : 'HRV'} (${data.unit})`
                : `Δ from baseline (${data.unit})`
            }
            intervals={intervals}
            markers={markers}
            height={318}
            ariaLabel={`${data.label} ${view} waveform`}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-micro text-muted">
              <Activity size={10} className="text-cyan" />
              <span>
                {snapshot.vitals.hr} BPM · HRV {snapshot.vitals.hrv} ms · SpO₂ {snapshot.vitals.spo2.toFixed(1)}%
              </span>
            </div>
            {zoom > 1 ? (
              <label className="flex min-w-[190px] flex-1 items-center gap-2 sm:flex-none">
                <span className="font-mono text-[8px] uppercase tracking-micro text-muted">pan</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={pan}
                  onChange={(event) => setPan(Number(event.target.value))}
                  aria-label="Pan signal window"
                  className="h-1 w-full accent-cyan sm:w-36"
                />
                <span className="w-12 text-right font-mono text-[8px] tabular-nums text-muted">
                  −{Math.abs(Math.round(viewEnd))}s
                </span>
              </label>
            ) : (
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted/60">
                select 2× or 4× to inspect a shorter span
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line-soft border-t border-line-soft bg-base/25 sm:grid-cols-4">
          {windowRail}
        </div>
      </Panel>

      <div className="mt-3">
        <Panel
          bracket
          eyebrow="Multi-window fusion"
          title="Window Evidence"
          bodyClassName="p-0"
          actions={<Badge tone={flagged >= 2 ? 'amber' : 'green'} dot>{flagged}/4 flagged</Badge>}
          footer={
            <span className="font-mono text-[8.5px] leading-relaxed uppercase tracking-micro text-muted">
              Rule · ≥2 of 4 windows above mean + 2σ · witness ≥1 upgrades suspected → confirmed
            </span>
          }
        >
            <div className="divide-y divide-line-soft">
              {snapshot.windows.map((window) => (
                <div key={window.windowSeconds} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-[9px] text-ink">
                      <span className={cn('h-1.5 w-1.5 rounded-full', window.flagged ? 'bg-amber' : 'bg-green')} />
                      {window.windowSeconds}s · {window.model}
                    </span>
                    <span className={cn('font-mono text-[8.5px]', window.flagged ? 'text-amber' : 'text-muted')}>
                      {window.ratio.toFixed(2)}×
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-ink">
                      {window.reconstructionError.toFixed(4)}
                      <span className="ml-1 text-[8px] text-muted">/ {window.threshold.toFixed(4)}</span>
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
                      {window.flagged ? 'above threshold' : 'within band'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="label-xs">Witness channels</span>
                <span className="font-mono text-[9px] text-ink">
                  {snapshot.fusion.witnesses.length
                    ? snapshot.fusion.witnesses.join(' · ').toUpperCase()
                    : 'none co-affected'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge tone="neutral" className="!text-[7px]">HRV</Badge>
                <Badge tone="neutral" className="!text-[7px]">SpO₂</Badge>
                <Badge tone="neutral" className="!text-[7px]">TEMP</Badge>
                <Badge tone="neutral" className="!text-[7px]">RECOVERY</Badge>
              </div>
            </div>
          </Panel>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-micro text-muted/70">
        <span className="flex items-center gap-1.5">
          <AudioWaveform size={9} /> {data.windowSeconds}s raw window · {data.raw.length} samples · {data.simulated ? 'simulated demo arrays' : 'live arrays'}
        </span>
        <span className="flex items-center gap-1.5">
          <Maximize2 size={9} /> axes in seconds / {data.unit} · hover for sample values
        </span>
      </div>
    </section>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-[2px] w-4 rounded"
        style={{
          background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` : color,
        }}
      />
      {label}
    </span>
  );
}
