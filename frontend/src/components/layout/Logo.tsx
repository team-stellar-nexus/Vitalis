import { useId } from 'react';

/** VITALIS mark: a hex aperture with an orbital trace. */
export function NexusMark({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Vitalis"
    >
      <defs>
        <linearGradient id={`mark-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#35D9F2" />
          <stop offset="55%" stopColor="#438AFF" />
          <stop offset="100%" stopColor="#9675FF" />
        </linearGradient>
      </defs>
      <path
        d="M20 2.6 34.4 11v18L20 37.4 5.6 29V11L20 2.6Z"
        fill={`url(#mark-${id})`}
        fillOpacity="0.1"
        stroke={`url(#mark-${id})`}
        strokeWidth="1.1"
      />
      <path
        d="M20 10.2 27.6 14.6v8.8L20 27.8l-7.6-4.4v-8.8L20 10.2Z"
        fill={`url(#mark-${id})`}
        fillOpacity="0.16"
        stroke={`url(#mark-${id})`}
        strokeWidth="0.9"
      />
      <circle cx="20" cy="19" r="2.1" fill="#35D9F2" />
      <ellipse
        cx="20"
        cy="19"
        rx="14"
        ry="5.6"
        fill="none"
        stroke="#35D9F2"
        strokeOpacity="0.5"
        strokeWidth="0.75"
        transform="rotate(-28 20 19)"
      />
      <circle cx="31.4" cy="13.6" r="1.3" fill="#9675FF" />
    </svg>
  );
}

export function NexusWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="min-w-0 flex items-center gap-1.5 font-display text-[15px] font-semibold leading-none tracking-[0.06em] text-ink">
      VITALIS
      {!compact && (
        <span className="ml-0.5 border border-line px-1 py-[1px] font-mono text-[7px] tracking-micro text-muted">
          v1.0
        </span>
      )}
    </div>
  );
}
