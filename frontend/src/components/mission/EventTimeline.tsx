import { Badge, SEVERITY_TONE } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SENSORS } from '@/lib/sensors';
import { useNow } from '@/lib/hooks';
import type { MissionEvent } from '@/lib/types';
import { cn, formatUtcStamp, relativeTime } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Activity, Cpu, GitCompareArrows, Layers, ShieldAlert, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON: Record<MissionEvent['category'], LucideIcon> = {
  sensor: Activity,
  signal: Waves,
  fusion: Layers,
  witness: GitCompareArrows,
  alert: ShieldAlert,
  system: Cpu,
};

const ICON_TONE: Record<MissionEvent['severity'], string> = {
  info: 'text-blue border-blue/25 bg-blue/[0.07]',
  success: 'text-green border-green/25 bg-green/[0.07]',
  warning: 'text-amber border-amber/25 bg-amber/[0.07]',
  critical: 'text-red border-red/30 bg-red/[0.08]',
};

/** Section I — chronological mission event feed. */
export function EventTimeline({
  limit = 40,
  className,
  showAllLink = false,
}: {
  limit?: number;
  className?: string;
  showAllLink?: boolean;
}) {
  const { snapshot } = useTelemetry();
  const now = useNow(5000);
  const events = snapshot.events.slice(0, limit);

  return (
    <Panel
      bracket
      eyebrow="Chronological health feed · simulated events"
      title="Health Updates"
      actions={
        <>
          <Badge tone="neutral">{snapshot.events.length}</Badge>
          <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-micro text-muted">
            <span className="h-1 w-1 rounded-full bg-green anim-pulse-dot" /> live
          </span>
        </>
      }
      className={cn('h-full', className)}
      bodyClassName="p-0"
      footer={
        showAllLink ? (
          <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
            Showing latest {events.length} of {snapshot.events.length} events
          </span>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
            Severity · info / success / warning / critical
          </span>
        )
      }
    >
      <ol className="max-h-[360px] divide-y divide-line-soft overflow-y-auto">
        {events.map((event) => {
          const Icon = ICON[event.category];
          return (
            <li key={event.id} className="flex gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.025]">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border',
                  ICON_TONE[event.severity],
                )}
              >
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-ink">{event.title}</span>
                  <span
                    className="shrink-0 font-mono text-[8px] tabular-nums text-muted"
                    title={formatUtcStamp(new Date(event.timestamp))}
                  >
                    {relativeTime(event.timestamp, now)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">{event.detail}</p>
                <div className="mt-1 flex items-center gap-2 font-mono text-[8px] uppercase tracking-micro text-muted/70">
                  <Badge tone={SEVERITY_TONE[event.severity]} className="!px-1 !py-0 !text-[7px]">
                    {event.severity}
                  </Badge>
                  <span className="text-cyan/80">{event.astronautName ?? snapshot.astronaut.name}</span>
                  <span>·</span>
                  <span className="text-ink/70">
                    {event.channel === 'multi'
                      ? 'MULTI'
                      : event.channel
                        ? SENSORS[event.channel].short
                        : event.category.toUpperCase()}
                  </span>
                  <span>·</span>
                  <span className="text-muted/80">{event.status ?? 'logged'}</span>
                  <span className="text-muted/40">/</span>
                  <span>{event.id}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
