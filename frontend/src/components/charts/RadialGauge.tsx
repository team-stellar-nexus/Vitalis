import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const ARC_FRACTION = 0.75;

/**
 * 270° risk gauge with 30 minor ticks. The arc colour follows alert semantics,
 * not the raw number, so a "suspected" score never reads as green.
 */
export function RadialGauge({
  value,
  size = 230,
  strokeWidth = 8,
  children,
  label,
  color = '#35D9F2',
  className,
  showValue = true,
  sublabel,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
  label?: string;
  color?: string;
  className?: string;
  showValue?: boolean;
  sublabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * ARC_FRACTION;
  const offset = arcLength * (1 - clamped / 100);
  const ticks = Array.from({ length: 31 }, (_, i) => {
    const angle = ((135 + (i / 30) * 270) * Math.PI) / 180;
    const inner = i % 5 === 0 ? 90 : 94;
    return {
      x1: 100 + Math.cos(angle) * inner,
      y1: 100 + Math.sin(angle) * inner,
      x2: 100 + Math.cos(angle) * 99,
      y2: 100 + Math.sin(angle) * 99,
      major: i % 5 === 0,
    };
  });

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label ?? 'Risk gauge'}>
        <defs>
          <linearGradient id={`gauge-${color.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="55%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor="#EAF3FF" stopOpacity={0.85} />
          </linearGradient>
          <filter id="gauge-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.major ? 'rgba(130,150,173,0.55)' : 'rgba(130,150,173,0.22)'}
            strokeWidth={t.major ? 1.1 : 0.7}
          />
        ))}

        <g transform="rotate(135 100 100)">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(130,150,173,0.16)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={`url(#gauge-${color.replace('#', '')})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
            filter="url(#gauge-glow)"
          />
        </g>

        {/* Current-value marker */}
        <g
          transform={`rotate(${135 + (clamped / 100) * 270} 100 100)`}
          style={{ transition: 'transform 700ms cubic-bezier(0.16,1,0.3,1)' }}
        >
          <circle cx={100 + radius} cy="100" r="2.6" fill="#EAF3FF" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <div className="label-xs mb-1">{label}</div>
            {showValue && (
              <div className="flex items-baseline gap-0.5">
                <AnimatedNumber
                  value={clamped}
                  className="font-mono text-[42px] font-medium leading-none tracking-tighter text-ink"
                />
                <span className="font-mono text-xs text-muted">/100</span>
              </div>
            )}
            {sublabel && <div className="mt-1 font-mono text-[9px] uppercase tracking-micro text-muted">{sublabel}</div>}
          </>
        )}
      </div>
    </div>
  );
}
