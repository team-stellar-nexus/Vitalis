import { IconButton } from '@/components/ui/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible expanded-chart overlay. Escape or the backdrop closes it; body
 * scroll is locked while open. Content scrolls internally so a 520 px chart
 * still fits a 768 px display.
 */
export function ExpandDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-5">
          <motion.button
            type="button"
            aria-label="Close expanded view"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-default bg-black/78 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[94vh] w-full max-w-[1480px] flex-col overflow-hidden rounded-lg border border-line bg-[#0A1320] shadow-panel"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5">
              <div className="min-w-0">
                <div className="label-xs mb-1 text-muted">Expanded view</div>
                <h2 className="truncate font-display text-[14px] font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {subtitle && (
                  <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-micro text-muted">
                    {subtitle}
                  </div>
                )}
              </div>
              <IconButton label="Close expanded view" onClick={onClose}>
                <X size={14} />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">{children}</div>
            {footer && (
              <footer className="border-t border-line-soft px-4 py-2 text-[10px] text-muted">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
