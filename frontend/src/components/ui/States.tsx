import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('anim-shimmer rounded bg-white/[0.03]', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line bg-base/30 px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="text-muted/70">{icon}</div>}
      <h3 className="font-display text-sm font-medium text-ink">{title}</h3>
      <p className="max-w-sm text-[11px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  detail,
  action,
  className,
}: {
  title: string;
  description: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border border-amber/25 bg-amber/[0.04] p-4',
        className,
      )}
    >
      <div className="label text-amber">Integration offline</div>
      <h3 className="font-display text-sm font-medium text-ink">{title}</h3>
      <p className="text-[11px] leading-relaxed text-muted">{description}</p>
      {detail && (
        <code className="mt-1 block w-full overflow-x-auto rounded border border-line bg-base/70 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted">
          {detail}
        </code>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
