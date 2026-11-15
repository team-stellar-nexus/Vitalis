import { cn } from '@/lib/utils';

/**
 * Per-metric micro-visualisations.
 *
 * RRTachogram is a stem plot of successive R-R intervals around their mean, so
 * the HRV card shows beat-to-beat variability rather than a second heartbeat
 * shape. Values are synthetic and derived from the simulation's HR/HRV pair.
 */
export function RRTachogram({
  intervals,
  color = '#9675FF',
  height = 44,
  className,
}: {
  intervals: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (!intervals.length) {
    return (
      <div
        className={cn('w-full rounded border border-dashed border-line/70', className)}
        style={{ height }}
        aria-hidden
      />
    );
  }

  const W = 120;
  const H = 36;
  const min = Math.min(...intervals);
  const max = Math.max(...intervals);
  const pad = Math.max(6, (max - min) * 0.18);
  const lo = min - pad;
  const hi = max + pad;
  const span = hi - lo || 1;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const y = (v: number) => H - ((v - lo) / span) * H;
  const meanY = y(mean);
  const step = W / intervals.length;
  const barWidth = Math.max(1.2, step * 0.52);

  return (
    <div className={cn('relative w-full', className)} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <line
          x1="0"
          x2={W}
          y1={meanY}
          y2={meanY}
          stroke="rgba(130,150,173,0.45)"
          strokeWidth={0.8}
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
        {intervals.map((value, index) => {
          const valueY = y(value);
          const magnitude = Math.abs(value - mean);
          return (
            <rect
              key={index}
              x={index * step + (step - barWidth) / 2}
              y={Math.min(valueY, meanY)}
              width={barWidth}
              height={Math.max(0.7, Math.abs(valueY - meanY))}
              rx={0.35}
              fill={color}
              opacity={magnitude > 24 ? 0.95 : 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Motion-index bars (0–100 scale) for the activity card. */
export function ActivityBars({
  data,
  color = '#35D49A',
  height = 44,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const W = 120;
  const H = 36;
  const step = W / Math.max(1, data.length);
  const barWidth = Math.max(1.6, step * 0.56);

  return (
    <div className={cn('relative w-full', className)} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <line
          x1="0"
          x2={W}
          y1={H * 0.5}
          y2={H * 0.5}
          stroke="rgba(130,150,173,0.22)"
          strokeDasharray="2 3"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        {data.map((value, index) => {
          const h = Math.max(1.4, (Math.max(0, Math.min(100, value)) / 100) * H);
          return (
            <rect
              key={index}
              x={index * step + (step - barWidth) / 2}
              y={H - h}
              width={barWidth}
              height={h}
              rx={0.4}
              fill={color}
              opacity={index === data.length - 1 ? 0.95 : 0.38}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Seven-night recovery bars with a 70-point target line. */
export function NightBars({
  values,
  color = '#8FB3FF',
  height = 44,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const W = 120;
  const H = 36;
  const step = W / Math.max(1, values.length);
  const barWidth = Math.max(3, step * 0.5);
  const targetY = H - (70 / 100) * H;

  return (
    <div className={cn('relative w-full', className)} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <line
          x1="0"
          x2={W}
          y1={targetY}
          y2={targetY}
          stroke="#35D49A"
          strokeOpacity={0.35}
          strokeDasharray="2 3"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        {values.map((value, index) => {
          const h = Math.max(1.5, (Math.max(0, Math.min(100, value)) / 100) * H);
          const latest = index === values.length - 1;
          return (
            <g key={index}>
              <rect
                x={index * step + (step - barWidth) / 2}
                y={0}
                width={barWidth}
                height={H}
                fill="rgba(130,150,173,0.08)"
                rx={0.4}
              />
              <rect
                x={index * step + (step - barWidth) / 2}
                y={H - h}
                width={barWidth}
                height={h}
                fill={color}
                opacity={latest ? 0.95 : 0.45}
                rx={0.4}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
