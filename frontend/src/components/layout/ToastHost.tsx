import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Transient visual alert for simulated anomalies. Sound is handled separately. */
export function ToastHost() {
  const { toast, dismissToast, snapshot } = useTelemetry();
  const navigate = useNavigate();
  const confirmed = toast?.status === 'confirmed';

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cn(
              'pointer-events-auto overflow-hidden rounded-md border bg-[#0A1320]/97 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur',
              confirmed ? 'border-red/45' : 'border-amber/45',
            )}
          >
            <div
              className={cn(
                'flex items-start gap-2.5 border-b px-3 py-2.5',
                confirmed ? 'border-red/25 bg-red/[0.08]' : 'border-amber/25 bg-amber/[0.07]',
              )}
            >
              <span className={confirmed ? 'text-red' : 'text-amber'}>
                {confirmed ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="label-xs text-muted">
                  {confirmed ? 'Fusion + witness rule met' : 'Window fusion met'}
                </div>
                <div
                  className={cn(
                    'font-display text-[13px] font-semibold tracking-tight',
                    confirmed ? 'text-red' : 'text-amber',
                  )}
                >
                  {confirmed ? 'MITOCHONDRIAL STRESS RISK ALERT' : 'SUSPECTED PHYSIOLOGICAL ANOMALY'}
                </div>
              </div>
              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss alert"
                className="-mr-1 rounded p-1 text-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-4 font-mono text-[10px] text-muted">
                <span>
                  RISK <span className="text-ink">{toast.score}/100</span>
                </span>
                <span>
                  WINDOWS <span className="text-ink">{snapshot.fusion.flaggedCount}/4</span>
                </span>
                <span>
                  WITNESS <span className="text-ink">{snapshot.fusion.witnesses.length}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                Simulated demo logic. Risk inference from physiological signal deviations — not a
                medical diagnosis.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    navigate('/anomaly-detection');
                    dismissToast();
                  }}
                >
                  Open analysis
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissToast}>
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
