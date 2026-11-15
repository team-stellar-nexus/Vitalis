import type { SignalPoint } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo, useRef, useState } from 'react';

export interface PlotSeries {
  key: string;
  label: string;
  color: string;
  points: SignalPoint[];
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export interface PlotInterval {
  start: number;
  end: number;
  label: string;
  color: string;
}

export interface PlotMarker {
  t: number;
  label: string;
  color: string;
}

const W = 1000;
const H = 300;
const L = 58;
const R = 18;
const T = 16;
const B = 36;

const trim = (points: SignalPoint[], range: number) =>
  points.filter((point) => point.t >= -range && point.t <= 0.01);

function decimalsFor(unit: string): number {
  if (unit === 'ms') return 0;
  if (unit === 'a.u.') return 3;
  return 2;
}

function formatNumber(value: number, digits: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(Math.min(1, digits));
  return value.toFixed(digits);
}

/**
 * The observatory's primary time-series renderer. It draws the actual arrays
 * supplied by the simulation/backend, with a shared amplitude domain, absolute
 * time axis, baseline overlay, highlighted deviation intervals and event
 * markers. Hovering a point produces a channel readout; zoom is applied by the
 * parent through the `range` prop and point window.
 */
export function SignalPlot({
  series,
  range,
  unit,
  yLabel,
  intervals = [],
  markers = [],
  endOffset = 0,
  height = 318,
  ariaLabel = 'Physiological signal waveform',
}: {
  series: PlotSeries[];
  range: number;
  unit: string;
  yLabel: string;
  intervals?: PlotInterval[];
  markers?: PlotMarker[];
  /** Offset of the right-hand edge in seconds relative to now (0 = latest). */
  endOffset?: number;
  height?: number;
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const digits = decimalsFor(unit);

  const visible = useMemo(
    () =>
      series.map((entry) => ({
        ...entry,
        points: trim(entry.points, range),
      })),
    [series, range],
  );

  const allValues = visible.flatMap((entry) => entry.points.map((point) => point.v));
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 1;
  const span = rawMax - rawMin || 1;
  const pad = Math.max(span * 0.14, 0.01);
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin || 1;

  const xAt = (t: number) => L + ((t + range) / range) * (W - L - R);
  const yAt = (v: number) => T + (1 - (v - yMin) / yRange) * (H - T - B);

  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    const seconds = endOffset - range * (1 - fraction);
    return {
      x: L + fraction * (W - L - R),
      label:
        fraction === 1 && endOffset === 0
          ? 'NOW'
          : `−${Math.max(0, Math.round(Math.abs(seconds)))}s`,
    };
  });

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = yMax - (index / 4) * yRange;
    return { y: T + (index / 4) * (H - T - B), label: formatNumber(value, digits) };
  });

  const hover = useMemo(() => {
    if (hoverT === null) return null;
    const nearest = visible
      .map((entry) => {
        let closest: SignalPoint | null = null;
        let distance = Number.POSITIVE_INFINITY;
        entry.points.forEach((point) => {
          const delta = Math.abs(point.t - hoverT);
          if (delta < distance) {
            distance = delta;
            closest = point;
          }
        });
        return closest ? { ...entry, point: closest as SignalPoint } : null;
      })
      .filter((entry): entry is PlotSeries & { point: SignalPoint } => entry !== null);
    return nearest.length ? { t: hoverT, values: nearest } : null;
  }, [hoverT, visible]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    if (x < L || x > W - R) {
      setHoverT(null);
      return;
    }
    const fraction = (x - L) / (W - L - R);
    setHoverT(fraction * range - range);
  };

  if (!visible.some((entry) => entry.points.length)) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 rounded border border-dashed border-line bg-base/30 text-center"
        style={{ height }}
      >
        <span className="label text-amber">No samples in selected window</span>
        <span className="max-w-xs text-[10px] leading-relaxed text-muted">
          The signal buffer is empty or the channel is offline. Check the sensor link or return to
          DEMO mode.
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded border border-line-soft bg-[#060C16]/60"
      style={{ height }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverT(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`${ariaLabel}. ${range} second window. Simulated signal arrays.`}
      >
        <defs>
          <linearGradient id="signal-plot-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1A2A" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#060C16" stopOpacity="0.12" />
          </linearGradient>
          {visible.map((entry) => (
            <linearGradient key={`fill-${entry.key}`} id={`fill-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={entry.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="url(#signal-plot-bg)" />

        {yTicks.map((tick, index) => (
          <g key={`y-${index}`}>
            <line
              x1={L}
              x2={W - R}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(130,150,173,0.13)"
              strokeWidth="0.7"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {xTicks.map((tick, index) => (
          <g key={`x-${index}`}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={T}
              y2={H - B}
              stroke="rgba(130,150,173,0.1)"
              strokeWidth="0.7"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {intervals.map((interval, index) => {
          const start = Math.max(-range, interval.start);
          const end = Math.min(0, interval.end);
          const x = xAt(start);
          const width = Math.max(2, xAt(end) - x);
          return (
            <g key={`interval-${index}`}>
              <rect
                x={x}
                y={T}
                width={width}
                height={H - T - B}
                fill={interval.color}
                fillOpacity="0.07"
                stroke={interval.color}
                strokeOpacity="0.28"
                strokeWidth="0.7"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {visible.map((entry) => {
          const line = entry.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(point.t).toFixed(2)},${yAt(point.v).toFixed(2)}`)
            .join(' ');
          const area =
            entry.key === 'raw'
              ? `${line} L${xAt(entry.points[entry.points.length - 1].t).toFixed(2)},${H - B} L${xAt(entry.points[0].t).toFixed(2)},${H - B} Z`
              : null;
          return (
            <g key={entry.key}>
              {area && <path d={area} fill={`url(#fill-${entry.key})`} />}
              <path
                d={line}
                fill="none"
                stroke={entry.color}
                strokeWidth={entry.width ?? 1.4}
                strokeOpacity={entry.opacity ?? 1}
                strokeDasharray={entry.dashed ? '4 5' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: entry.dashed ? undefined : `drop-shadow(0 0 4px ${entry.color}55)` }}
              />
            </g>
          );
        })}

        <line
          x1={L}
          x2={W - R}
          y1={H - B}
          y2={H - B}
          stroke="rgba(27,48,71,1)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={L}
          x2={L}
          y1={T}
          y2={H - B}
          stroke="rgba(27,48,71,1)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {markers.map((marker, index) => {
          const x = xAt(Math.max(-range, Math.min(0, marker.t)));
          return (
            <g key={`marker-${marker.label}-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={T}
                y2={H - B}
                stroke={marker.color}
                strokeWidth="1"
                strokeDasharray="2 4"
                strokeOpacity="0.8"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={x} cy={T + 5} r="2.2" fill={marker.color} />
            </g>
          );
        })}

        {hover && (
          <g>
            <line
              x1={xAt(hover.t)}
              x2={xAt(hover.t)}
              y1={T}
              y2={H - B}
              stroke="rgba(234,243,255,0.5)"
              strokeWidth="0.8"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
            {hover.values.map((entry) => (
              <circle
                key={`hover-${entry.key}`}
                cx={xAt(entry.point.t)}
                cy={yAt(entry.point.v)}
                r="2.4"
                fill={entry.color}
                stroke="#060C16"
                strokeWidth="1"
              />
            ))}
          </g>
        )}

      </svg>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {yTicks.map((tick, index) => (
          <span
            key={`y-label-${index}`}
            className="absolute left-1 w-11 -translate-y-1/2 text-right font-mono text-[8px] tabular-nums text-muted/80"
            style={{ top: `${(tick.y / H) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
        {xTicks.map((tick, index) => (
          <span
            key={`x-label-${index}`}
            className={cn(
              'absolute bottom-1.5 font-mono text-[8px] text-muted/80',
              index === 0 ? 'translate-x-0' : index === 4 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{ left: `${(tick.x / W) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[7px] uppercase tracking-micro text-muted/40">
          time relative to now
        </span>
        <span className="absolute left-0 top-1/2 origin-center -translate-y-1/2 -rotate-90 whitespace-nowrap font-mono text-[7px] uppercase tracking-micro text-muted/40">
          {yLabel}
        </span>
        {intervals.map((interval, index) => {
          const end = Math.min(0, interval.end);
          return (
            <span
              key={`interval-label-${index}`}
              className="absolute top-2 -translate-x-full whitespace-nowrap rounded bg-[#060C16]/80 px-1 py-0.5 font-mono text-[7px] tracking-wide"
              style={{ left: `${(xAt(end) / W) * 100}%`, color: interval.color }}
            >
              {interval.label}
            </span>
          );
        })}
        {markers.map((marker, index) => {
          const x = xAt(Math.max(-range, Math.min(0, marker.t)));
          return (
            <span
              key={`marker-label-${marker.label}-${index}`}
              className="absolute top-5 whitespace-nowrap font-mono text-[7px]"
              style={{ left: `${(x / W) * 100}%`, color: marker.color }}
            >
              {marker.label}
            </span>
          );
        })}
      </div>

      {hover && (
        <div
          className={cn(
            'pointer-events-none absolute top-3 z-20 w-[148px] rounded border border-line bg-[#0A1320]/97 p-2 shadow-panel backdrop-blur',
            xAt(hover.t) > W * 0.72 ? 'right-3' : 'left-14',
          )}
        >
          <div className="font-mono text-[8px] uppercase tracking-micro text-muted">
            T {hover.t >= -0.5 ? '0.0' : hover.t.toFixed(1)} s
          </div>
          <div className="mt-1 space-y-1">
            {hover.values.map((entry) => (
              <div key={`readout-${entry.key}`} className="flex items-center gap-1.5">
                <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: entry.color }} />
                <span className="truncate text-[9px] text-muted">{entry.label}</span>
                <span className="ml-auto font-mono text-[9px] tabular-nums text-ink">
                  {formatNumber(entry.point.v, digits)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 border-t border-line-soft pt-1 font-mono text-[7.5px] text-muted/70">
            {unit} · simulated
          </div>
        </div>
      )}
    </div>
  );
}
