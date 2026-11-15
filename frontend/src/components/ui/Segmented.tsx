import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
  label,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded border border-line bg-base/60 p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-sm px-2 font-mono text-[10px] uppercase tracking-wide transition-colors',
              size === 'sm' ? 'h-6' : 'h-7 px-2.5',
              active
                ? 'bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_rgba(53,217,242,0.28)]'
                : 'text-muted hover:bg-white/[0.05] hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
