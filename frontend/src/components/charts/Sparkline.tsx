import { cn } from '@/lib/utils';
import { useId } from 'react';

/**
 * Compact SVG trend line with a soft gradient fill, used inside health cards.
 * Coordinates are normalised to a fixed viewBox so it resizes fluidly.
 */
export function Sparkline({
  data,
  color = '#35D9F2',
  height = 34,
  threshold,
  className,
  fill = true,
  min,
  max,
  band,
}: {
  data: number[];
  color?: string;
  height?: number;
  threshold?: number;
  className?: string;
  fill?: boolean;
  min?: number;
  max?: number;
  /** Normal-range band drawn behind the trace, in data units. */
  band?: [number, number];
}) {
  const gradientId = useId().replace(/:/g, '');
  if (!data.length) return <div className={cn('w-full', className)} style={{ height }} />;

  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const pad = span * 0.18;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const range = yMax - yMin || 1;

  const W = 100;
  const H = 32;
  const xAt = (i: number) => (i / Math.max(1, data.length - 1)) * W;
  const yAt = (v: number) => H - ((v - yMin) / range) * H;

  const line = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`)
    .join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const lastX = xAt(data.length - 1);
  const lastY = yAt(data[data.length - 1]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {band &&
          (() => {
            const top = yAt(Math.min(band[1], yMax));
            const bottom = yAt(Math.max(band[0], yMin));
            return bottom > top ? (
              <rect
                x="0"
                y={top}
                width={W}
                height={bottom - top}
                fill={color}
                opacity={0.07}
              />
            ) : null;
          })()}
        {threshold !== undefined && threshold >= yMin && threshold <= yMax && (
          <line
            x1="0"
            x2={W}
            y1={yAt(threshold)}
            y2={yAt(threshold)}
            stroke="#FFB84D"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {fill && <path d={area} fill={`url(#${gradientId})`} />}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lastX} cy={lastY} r={1.6} fill={color} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
