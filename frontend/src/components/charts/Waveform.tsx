import type { SignalPoint } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useId } from 'react';

/**
 * High-density waveform renderer. Rendered as a single SVG path (no per-sample
 * dots) so a 50 Hz PPG buffer stays cheap; `preserveAspectRatio="none"` lets it
 * fill any panel width without re-computation.
 */
export function Waveform({
  points,
  color = '#35D9F2',
  height = 130,
  className,
  fill = true,
  showScan = true,
  showZeroLine = false,
  ariaLabel = 'Waveform',
}: {
  points: SignalPoint[];
  color?: string;
  height?: number;
  className?: string;
  fill?: boolean;
  showScan?: boolean;
  showZeroLine?: boolean;
  ariaLabel?: string;
}) {
  const gradientId = useId().replace(/:/g, '');

  if (!points.length) {
    return (
      <div
        className={cn('flex items-center justify-center rounded border border-dashed border-line text-[10px] text-muted', className)}
        style={{ height }}
      >
        No samples in buffer
      </div>
    );
  }

  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const yMin = lo - span * 0.12;
  const yMax = hi + span * 0.12;
  const range = yMax - yMin || 1;

  const W = 600;
  const H = 100;
  const xAt = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const yAt = (v: number) => H - ((v - yMin) / range) * H;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yAt(p.v).toFixed(2)}`)
    .join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div className={cn('relative w-full overflow-hidden', className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={i}
            x1="0"
            x2={W}
            y1={(H / 4) * i}
            y2={(H / 4) * i}
            stroke="rgba(130,150,173,0.12)"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {showZeroLine && yAt(0) > 0 && yAt(0) < H && (
          <line
            x1="0"
            x2={W}
            y1={yAt(0)}
            y2={yAt(0)}
            stroke="rgba(130,150,173,0.3)"
            strokeDasharray="2 4"
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {fill && <path d={area} fill={`url(#${gradientId})`} />}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}
        />
      </svg>
      {showScan && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="anim-sweep h-full w-1/4 opacity-70"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}14, transparent)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
