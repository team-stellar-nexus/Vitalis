import { Badge } from '@/components/ui/Badge';
import { profileInitials, riskBand, riskTone } from '@/lib/crew';
import { useClickOutside } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, UserRound } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

/**
 * Global astronaut profile selector. Selecting a crew member swaps the active
 * simulation engine, so every route and every panel reads that astronaut's own
 * baseline, signals, anomalies, witnesses and event history.
 */
export function CrewSelector() {
  const { profiles, activeProfile, selectProfile, snapshot } = useTelemetry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const tone = riskTone(snapshot.anomaly.status);
  const dot = tone === 'red' ? 'bg-red' : tone === 'amber' ? 'bg-amber' : 'bg-green';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Astronaut profile: ${activeProfile.name}. Open crew selector.`}
        className="flex h-8 max-w-[220px] items-center gap-2 rounded border border-line bg-white/[0.02] px-1.5 pr-2 text-left transition-colors hover:border-cyan/35 hover:bg-white/[0.04]"
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/10 font-display text-[8px] font-semibold text-cyan">
          {profileInitials(activeProfile.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-medium leading-tight text-ink">
            {activeProfile.name}
          </span>
          <span className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-micro text-muted">
            <span className={cn('h-1 w-1 rounded-full', dot)} />
            {activeProfile.id} · {riskBand(snapshot.anomaly.status)}
          </span>
        </span>
        <ChevronDown
          size={11}
          className={cn('ml-auto shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="listbox"
            aria-label="Astronaut profiles"
            className="absolute left-0 top-full z-50 mt-2 w-[330px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-line bg-[#0A1320] shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
              <span className="label-xs">Crew profiles</span>
              <Badge tone="cyan">Synthetic</Badge>
            </div>
            <div className="max-h-[390px] overflow-y-auto p-1.5">
              {profiles.map(({ profile, snapshot: member }) => {
                const memberTone = riskTone(member.anomaly.status);
                const memberDot =
                  memberTone === 'red' ? 'bg-red' : memberTone === 'amber' ? 'bg-amber' : 'bg-green';
                const selected = profile.profileId === activeProfile.profileId;
                return (
                  <button
                    key={profile.profileId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      selectProfile(profile.profileId);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded px-2 py-2 text-left transition-colors',
                      selected ? 'bg-cyan/[0.08]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-base/60 font-display text-[9px] font-semibold text-ink">
                      {profileInitials(profile.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-medium text-ink">{profile.name}</span>
                        <span className="font-mono text-[8px] text-muted">{profile.id}</span>
                        {selected && <Check size={11} className="ml-auto shrink-0 text-cyan" />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-micro text-muted">
                        <span className={cn('h-1 w-1 rounded-full', memberDot)} />
                        {riskBand(member.anomaly.status)} · {member.anomaly.score}/100
                        <span className="text-muted/50">/</span>
                        {profile.missionId}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[9px] leading-relaxed text-muted/85">
                        {profile.summary}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 border-t border-line-soft px-3 py-2 font-mono text-[8px] uppercase tracking-micro text-muted">
              <UserRound size={9} /> Switching updates every dashboard section
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
