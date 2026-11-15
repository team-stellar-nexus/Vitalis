import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'icon';

const BASE =
  'inline-flex select-none items-center justify-center gap-1.5 rounded font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<Variant, string> = {
  primary:
    'border border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/25 hover:border-cyan/60 shadow-[0_0_18px_-8px_rgba(53,217,242,0.7)]',
  outline: 'border border-line bg-white/[0.02] text-ink hover:border-cyan/40 hover:bg-white/[0.05]',
  ghost: 'border border-transparent text-muted hover:border-line hover:bg-white/[0.04] hover:text-ink',
  danger: 'border border-red/40 bg-red/10 text-red hover:bg-red/20',
  subtle: 'border border-line bg-surface text-ink hover:border-cyan/30 hover:bg-elevated',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2 text-[10px] tracking-wide uppercase font-mono',
  md: 'h-9 px-3.5 text-xs',
  icon: 'h-8 w-8',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({ variant = 'outline', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS.ghost, SIZES.icon, className)}
      {...props}
    >
      {children}
    </button>
  );
}
