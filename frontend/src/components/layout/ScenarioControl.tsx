import { Badge } from '@/components/ui/Badge';
import { useClickOutside } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { SCENARIO_LIST, SCENARIOS } from '@/simulation/scenarios';
import { useSettings } from '@/state/SettingsProvider';
import { useTelemetry } from '@/state/TelemetryProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

export function ScenarioControl() {
  const { settings, update } = useSettings();
  const { snapshot } = useTelemetry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const active = SCENARIOS[settings.scenario];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 items-center gap-2 rounded border px-2.5 transition-colors',
          active.accent === 'red'
            ? 'border-red/35 bg-red/10 text-red'
            : active.accent === 'amber'
              ? 'border-amber/35 bg-amber/10 text-amber'
              : 'border-line bg-white/[0.02] text-ink hover:border-cyan/30',
        )}
        title="Demo scenario selector"
      >
        <FlaskConical size={12} />
        <span className="hidden font-mono text-[9px] uppercase tracking-micro sm:inline">
          {active.short}
        </span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-md border border-line bg-[#0A1320] shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
              <span className="label-xs">Simulation scenario</span>
              <Badge tone="cyan">DEMO ONLY</Badge>
            </div>
            <div className="p-1.5">
              {SCENARIO_LIST.map((s) => {
                const selected = settings.scenario === s.id;
                const color =
                  s.accent === 'red' ? 'bg-red' : s.accent === 'amber' ? 'bg-amber' : 'bg-green';
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      update({ scenario: s.id });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded px-2 py-2 text-left transition-colors',
                      selected ? 'bg-cyan/[0.08]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', color)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink">{s.label}</span>
                        {selected && (
                          <span className="font-mono text-[8px] uppercase tracking-micro text-cyan">
                            active
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                        {s.description}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] text-muted/80">
                        {s.expected}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line-soft px-3 py-2 font-mono text-[9px] leading-relaxed text-muted">
              Active: {snapshot.fusion.flaggedCount}/4 windows · witnesses{' '}
              {snapshot.fusion.witnesses.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
