import { cn } from '@/lib/utils';

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-xs font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full border transition-colors',
          checked ? 'border-cyan/50 bg-cyan/25' : 'border-line bg-base',
          disabled && 'opacity-40',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-3 w-3 rounded-full transition-all',
            checked ? 'left-[16px] bg-cyan' : 'left-[3px] bg-muted',
          )}
        />
      </button>
    </div>
  );
}
