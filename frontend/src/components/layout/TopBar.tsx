import { ScenarioControl } from '@/components/layout/ScenarioControl';
import { CrewSelector } from '@/components/layout/CrewSelector';
import { Badge, LiveDot, SEVERITY_TONE } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { useClickOutside, useNow } from '@/lib/hooks';
import type { MissionEvent } from '@/lib/types';
import { cn, formatMet, formatUtcClock, relativeTime } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, Menu, Radio, Satellite, Waves } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EVENT_ROUTE: Record<MissionEvent['category'], string> = {
  sensor: '/sensor-intelligence',
  signal: '/signal-analysis',
  fusion: '/anomaly-detection',
  witness: '/anomaly-detection',
  alert: '/anomaly-detection',
  system: '/settings',
};

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { snapshot, mode, setMode, notifications } = useTelemetry();
  const now = useNow(1000);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const closeNotif = useCallback(() => setNotifOpen(false), []);
  useClickOutside(notifRef, closeNotif, notifOpen);
  const navigate = useNavigate();

  const met = useMemo(() => {
    const drift = snapshot.paused ? 0 : Math.max(0, (now - snapshot.lastUpdate) / 1000);
    return snapshot.metSeconds + drift;
  }, [snapshot.metSeconds, snapshot.lastUpdate, snapshot.paused, now]);

  const visibleEvents = notifications.events.slice(0, 7);

  return (
    <header className="sticky top-0 z-40 flex min-h-[54px] flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-[#070B14]/88 px-3 py-2 backdrop-blur-md lg:flex-nowrap lg:px-5">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-0.5 flex h-8 w-8 items-center justify-center rounded border border-line text-muted hover:text-ink lg:hidden"
      >
        <Menu size={15} />
      </button>

      <div className="flex items-center gap-2">
        <Satellite size={12} className="text-cyan" />
        <div>
          <div className="label-xs leading-none">Mission</div>
          <div className="font-mono text-[11px] leading-tight text-ink">{snapshot.mission.id}</div>
        </div>
      </div>
      <Divider />
      <CrewSelector />
      <Divider className="hidden sm:block" />
      <div className="hidden items-center gap-2 md:flex">
        <div>
          <div className="label-xs leading-none">MET</div>
          <div className="font-mono text-[11px] leading-tight tabular-nums text-ink">
            T+ {formatMet(met)}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 lg:gap-2.5">
        <div className="hidden items-center gap-2 rounded border border-line bg-white/[0.02] px-2 py-1 lg:flex">
          <LiveDot
            tone={mode === 'live' ? 'amber' : snapshot.health.link === 'nominal' ? 'green' : 'amber'}
            label={mode === 'live' ? 'Live link' : 'Sensors'}
          />
          <span className="font-mono text-[9px] text-muted">
            {snapshot.health.channelsOnline}/{snapshot.health.channelsTotal}
          </span>
          <span className="h-2.5 w-px bg-line" />
          <span className="font-mono text-[9px] tabular-nums text-muted">
            {snapshot.health.latencyMs}ms
          </span>
        </div>

        <div className="hidden items-center gap-2 rounded border border-line bg-white/[0.02] px-2 py-1 xl:flex">
          <span className="label-xs">UTC</span>
          <span className="font-mono text-[11px] tabular-nums text-ink">{formatUtcClock(new Date(now))}</span>
        </div>

        <ScenarioControl />

        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={`Notifications (${notifications.unread} unread)`}
            aria-expanded={notifOpen}
            className="relative flex h-8 w-8 items-center justify-center rounded border border-line bg-white/[0.02] text-muted transition-colors hover:border-cyan/30 hover:text-ink"
          >
            <Bell size={14} />
            {notifications.unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[13px] min-w-[13px] items-center justify-center rounded-full border border-[#070B14] bg-cyan px-0.5 font-mono text-[8px] font-semibold text-[#04121A]">
                {notifications.unread > 9 ? '9+' : notifications.unread}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-full z-50 mt-2 w-[330px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-line bg-[#0A1320] shadow-panel"
              >
                <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
                  <span className="label-xs">Event log · last {visibleEvents.length}</span>
                  <button
                    type="button"
                    onClick={notifications.markAllRead}
                    className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-micro text-muted transition-colors hover:text-cyan"
                  >
                    <CheckCheck size={11} /> Mark read
                  </button>
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {visibleEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        navigate(EVENT_ROUTE[event.category]);
                        setNotifOpen(false);
                      }}
                      className="flex w-full items-start gap-2 border-b border-line-soft/60 px-3 py-2 text-left transition-colors last:border-0 hover:bg-white/[0.04]"
                    >
                      <span className="mt-1">
                        <Badge tone={SEVERITY_TONE[event.severity]} dot>
                          {event.severity.slice(0, 4)}
                        </Badge>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-ink">{event.title}</span>
                          <span className="shrink-0 font-mono text-[8px] text-muted">
                            {relativeTime(event.timestamp, now)}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[10px] leading-relaxed text-muted">
                          {event.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-line-soft px-3 py-1.5">
                  <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
                    Simulated events
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/anomaly-detection');
                      setNotifOpen(false);
                    }}
                    className="font-mono text-[9px] uppercase tracking-micro text-cyan hover:underline"
                  >
                    View timeline
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Segmented
          label="Data source mode"
          options={[
            { value: 'demo', label: 'Demo', title: 'Simulated telemetry (default)' },
            { value: 'live', label: 'Live', title: 'Connect to the proposed backend contract' },
          ]}
          value={mode}
          onChange={(value) => setMode(value)}
        />

        {mode === 'live' ? (
          <Badge tone="amber" dot pulse>
            <Radio size={9} /> Live
          </Badge>
        ) : (
          <Badge tone="cyan" dot pulse className="hidden sm:inline-flex">
            Demo
          </Badge>
        )}
      </div>

      {/* Mobile second row: mission identity + utilities */}
      <div className="flex w-full items-center gap-3 overflow-x-auto pb-0.5 no-scrollbar md:hidden">
        <span className="font-mono text-[9px] text-muted">
          {snapshot.astronaut.name} · {snapshot.astronaut.id} · T+{formatMet(met)}
        </span>
        <span className="h-2.5 w-px shrink-0 bg-line" />
        <span className="font-mono text-[9px] tabular-nums text-muted">
          {formatUtcClock(new Date(now))}
        </span>
        <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-muted">
          <Waves size={10} className="text-cyan" /> {snapshot.health.channelsOnline}/6
        </span>
      </div>
    </header>
  );
}

function Divider({ className }: { className?: string }) {
  return <span className={cn('h-6 w-px bg-line', className)} aria-hidden />;
}
