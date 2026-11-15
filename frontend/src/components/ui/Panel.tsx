import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PanelProps {
  id?: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bracket?: boolean;
  flush?: boolean;
}

/**
 * Base instrument panel. A hairline top highlight and optional corner brackets
 * give the aerospace chrome without adding decorative noise.
 */
export function Panel({
  id,
  title,
  eyebrow,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  bracket = false,
  flush = false,
}: PanelProps) {
  return (
    <section
      id={id}
      className={cn(
        'relative flex min-w-0 flex-col rounded-lg border border-line card-surface inner-hairline shadow-panel',
        className,
      )}
    >
      {bracket && (
        <>
          <Corner className="left-[-1px] top-[-1px] border-l border-t" />
          <Corner className="right-[-1px] top-[-1px] border-r border-t" />
          <Corner className="bottom-[-1px] left-[-1px] border-b border-l" />
          <Corner className="bottom-[-1px] right-[-1px] border-b border-r" />
        </>
      )}
      {(title || eyebrow || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-2.5">
          <div className="min-w-[150px] flex-1">
            {eyebrow && <div className="label-xs mb-1 text-muted">{eyebrow}</div>}
            {title && (
              <h2 className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', flush ? '' : 'p-4', bodyClassName)}>{children}</div>
      {footer && (
        <footer className="border-t border-line-soft px-4 py-2 text-[10px] text-muted">{footer}</footer>
      )}
    </section>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute h-2.5 w-2.5 border-cyan/40', className)}
    />
  );
}
