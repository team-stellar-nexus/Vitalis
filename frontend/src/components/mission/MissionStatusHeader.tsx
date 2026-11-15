import { Badge, LiveDot } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { profileInitials, riskBand, riskTone } from '@/lib/crew';
import { useNow } from '@/lib/hooks';
import { formatUtcStamp, relativeTime } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Activity, ShieldAlert, ShieldCheck, Wifi } from 'lucide-react';

/**
 * Section A — a compact mission-health strip. Deliberately avoids a wall of
 * metric cards and oversized gauges: one identity, one mission, one risk band,
 * one link state and one freshness stamp.
 */
export function MissionStatusHeader() {
  const { snapshot, mode } = useTelemetry();
  const now = useNow(1000);
  const risk = riskBand(snapshot.anomaly.status);
  const tone = riskTone(snapshot.anomaly.status);
  const riskColor = tone === 'red' ? '#FF5364' : tone === 'amber' ? '#FFB84D' : '#35D49A';
  const activeSegments = Math.max(1, Math.round((snapshot.anomaly.score / 100) * 14));
  const connectionLabel = mode === 'demo' ? 'DEMO · SIMULATED' : 'LIVE · TRANSPORT';
  const connectionTone = mode === 'demo' ? 'cyan' : snapshot.health.link === 'nominal' ? 'green' : 'amber';

  return (
    <Panel flush bracket className="mb-3 overflow-hidden">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/30 bg-cyan/[0.08] font-display text-[13px] font-semibold text-cyan">
            {profileInitials(snapshot.astronaut.name)}
          </span>
          <div className="min-w-0">
            <div className="label-xs mb-1 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-cyan" /> Selected astronaut
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="font-display text-[18px] font-semibold leading-none tracking-tight text-ink">
                {snapshot.astronaut.name}
              </h1>
              <span className="font-mono text-[10px] text-cyan">{snapshot.astronaut.id}</span>
              <Badge tone="neutral" className="!text-[7px]">
                {snapshot.astronaut.rank}
              </Badge>
            </div>
            <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-micro text-muted">
              {snapshot.astronaut.role} · {snapshot.astronaut.baselineDays}d personal baseline
            </div>
          </div>
        </div>

        <Cell label="Mission" className="lg:border-l lg:border-line-soft lg:pl-4">
          <div className="font-mono text-[14px] leading-none text-ink">{snapshot.mission.id}</div>
          <div className="mt-1 truncate font-mono text-[8.5px] uppercase tracking-micro text-muted">
            {snapshot.mission.phase}
          </div>
        </Cell>

        <Cell label="Overall risk · compact indicator" className="lg:border-l lg:border-line-soft lg:pl-4">
          <div className="flex items-center gap-2">
            {snapshot.anomaly.status === 'normal' ? (
              <ShieldCheck size={13} className="text-green" />
            ) : snapshot.anomaly.status === 'suspected' ? (
              <Activity size={13} className="text-amber" />
            ) : (
              <ShieldAlert size={13} className="text-red" />
            )}
            <span className="font-mono text-[13px] leading-none" style={{ color: riskColor }}>
              {risk}
            </span>
            <span className="ml-auto font-mono text-[9px] tabular-nums text-muted">
              {snapshot.anomaly.score}/100
            </span>
          </div>
          <div className="mt-1.5 flex gap-[3px]" aria-hidden>
            {Array.from({ length: 14 }, (_, index) => (
              <span
                key={index}
                className="h-1.5 flex-1 rounded-[1px]"
                style={{
                  background: index < activeSegments ? riskColor : 'rgba(130,150,173,0.16)',
                  boxShadow: index < activeSegments ? `0 0 6px ${riskColor}66` : undefined,
                }}
              />
            ))}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-micro text-muted">
            {snapshot.anomaly.status === 'normal'
              ? 'Low · all windows within band'
              : snapshot.anomaly.status === 'suspected'
                ? 'Moderate · witness pending'
                : 'High · multi-channel flagged'}
          </div>
        </Cell>

        <Cell label="Monitoring connection" className="lg:border-l lg:border-line-soft lg:pl-4">
          <div className="flex items-center gap-1.5">
            <LiveDot tone={connectionTone} />
            <span className="font-mono text-[11px] text-ink">{connectionLabel}</span>
          </div>
          <div className="mt-1 font-mono text-[8.5px] uppercase tracking-micro text-muted">
            {snapshot.health.channelsOnline}/{snapshot.health.channelsTotal} channels · {snapshot.health.latencyMs} ms latency
          </div>
        </Cell>

        <Cell label="Last telemetry update" className="lg:border-l lg:border-line-soft lg:pl-4">
          <div className="font-mono text-[13px] tabular-nums leading-none text-ink">
            {snapshot.paused ? 'HELD' : relativeTime(snapshot.lastUpdate, now)}
          </div>
          <div className="mt-1 truncate font-mono text-[8.5px] text-muted">
            {formatUtcStamp(new Date(snapshot.lastUpdate))}
          </div>
        </Cell>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft bg-base/30 px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[8.5px] uppercase tracking-micro text-muted">
          <span className="flex items-center gap-1.5">
            <Wifi size={9} /> {mode === 'demo' ? 'Synthetic profile · no live crew link' : 'Backend transport'}
          </span>
          <span className="hidden sm:inline">Windows 30 / 60 / 120 / 240 s</span>
          <span className="hidden md:inline">PPG + R-R derived HRV</span>
        </div>
        <span className="font-mono text-[8px] uppercase tracking-micro text-muted/70">
          Not a diagnosis · no NASA affiliation
        </span>
      </div>
    </Panel>
  );
}

function Cell({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="label-xs mb-1.5">{label}</div>
      {children}
    </div>
  );
}
