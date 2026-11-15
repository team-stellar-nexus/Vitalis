import type { AnomalyStatus, ChannelStatus, Severity } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'cyan' | 'blue' | 'violet' | 'green' | 'amber' | 'red';

const TONE: Record<Tone, string> = {
  neutral: 'border-line bg-white/[0.03] text-muted',
  cyan: 'border-cyan/25 bg-cyan/10 text-cyan',
  blue: 'border-blue/25 bg-blue/10 text-blue',
  violet: 'border-violet/25 bg-violet/10 text-violet',
  green: 'border-green/25 bg-green/10 text-green',
  amber: 'border-amber/25 bg-amber/10 text-amber',
  red: 'border-red/25 bg-red/10 text-red',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
  pulse = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-micro',
        TONE[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('h-1 w-1 rounded-full bg-current', pulse && 'anim-pulse-dot')}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<AnomalyStatus, Tone> = {
  normal: 'green',
  suspected: 'amber',
  confirmed: 'red',
};

export const CHANNEL_TONE: Record<ChannelStatus, Tone> = {
  normal: 'green',
  anomaly: 'red',
  nodata: 'neutral',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  info: 'blue',
  success: 'green',
  warning: 'amber',
  critical: 'red',
};

export function StatusBadge({ status, className }: { status: AnomalyStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot pulse={status === 'confirmed'} className={className}>
      {status}
    </Badge>
  );
}

export function LiveDot({ tone = 'green', label }: { tone?: 'green' | 'amber' | 'red' | 'cyan'; label?: string }) {
  const color =
    tone === 'green' ? 'bg-green' : tone === 'amber' ? 'bg-amber' : tone === 'red' ? 'bg-red' : 'bg-cyan';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 anim-pulse-dot', color)} />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', color)} />
      </span>
      {label && <span className="font-mono text-[9px] uppercase tracking-micro text-muted">{label}</span>}
    </span>
  );
}
