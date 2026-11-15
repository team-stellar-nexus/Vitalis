import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Sparkline } from '@/components/charts/Sparkline';
import { profileInitials, riskBand, riskTone } from '@/lib/crew';
import { SENSORS } from '@/lib/sensors';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight, Check, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CrewProfiles() {
  const { profiles, activeProfile, selectProfile } = useTelemetry();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        eyebrow="Crew roster · independent simulation profiles"
        title="Astronaut Profiles"
        description="Each profile owns a separate simulation clock, personal baseline, signal buffer, anomaly log, witness state and event timeline. Switching profiles never mixes crew data. All physiology is synthetic."
        actions={
          <>
            <Badge tone="cyan" dot>
              {profiles.length} synthetic profiles
            </Badge>
            <Badge tone="neutral">
              active · {activeProfile.id}
            </Badge>
          </>
        }
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-3">
        {profiles.map(({ profile, snapshot: member }) => {
          const active = profile.profileId === activeProfile.profileId;
          const band = riskBand(member.anomaly.status);
          const tone = riskTone(member.anomaly.status);
          const color = tone === 'red' ? '#FF5364' : tone === 'amber' ? '#FFB84D' : '#35D49A';
          return (
            <Panel
              key={profile.profileId}
              bracket={active}
              className={cn(
                'flex flex-col transition-colors',
                active ? 'border-cyan/45' : 'hover:border-cyan/25',
              )}
              bodyClassName="flex flex-1 flex-col p-0"
              footer={
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
                    {profile.baselineDays}d baseline · {profile.baselineWindows.toLocaleString()} windows
                  </span>
                  <Button
                    size="sm"
                    variant={active ? 'primary' : 'outline'}
                    onClick={() => {
                      selectProfile(profile.profileId);
                      navigate('/');
                    }}
                  >
                    {active ? <Check size={11} /> : <ArrowUpRight size={11} />}
                    {active ? 'Current profile' : 'Open profile'}
                  </Button>
                </div>
              }
            >
              <div className="flex items-start gap-3 border-b border-line-soft px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/[0.08] font-display text-[12px] font-semibold text-cyan">
                  {profileInitials(profile.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate font-display text-[14px] font-semibold text-ink">{profile.name}</h2>
                    {active && <Badge tone="cyan" className="!text-[7px]">active</Badge>}
                  </div>
                  <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-micro text-muted">
                    {profile.id} · {profile.rank} · {profile.role}
                  </div>
                  <div className="mt-1 font-mono text-[8.5px] text-muted/80">
                    {profile.missionId} · {profile.phase}
                  </div>
                </div>
              </div>

              <div className="border-b border-line-soft px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-xs">Overall risk</span>
                  <span className="flex items-center gap-1.5">
                    {member.anomaly.status === 'normal' ? (
                      <ShieldCheck size={12} className="text-green" />
                    ) : (
                      <ShieldAlert size={12} style={{ color }} />
                    )}
                    <span className="font-mono text-[11px]" style={{ color }}>{band}</span>
                    <span className="font-mono text-[8px] text-muted">{member.anomaly.score}/100</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(3, member.anomaly.score)}%`, background: color }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[8px] uppercase tracking-micro text-muted">
                  <span>{member.fusion.flaggedCount}/4 windows flagged</span>
                  <span>{member.fusion.witnesses.length} witnesses</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-line-soft">
                <Measure
                  label="HR / HRV"
                  value={`${member.vitals.hr.toFixed(0)} / ${member.vitals.hrv.toFixed(0)}`}
                  unit="BPM / ms"
                  baseline={profile.baseline.hr}
                  trend={member.sensors.find((sensor) => sensor.id === 'hr')?.trend ?? []}
                  color={SENSORS.hr.color}
                />
                <Measure
                  label="SpO₂"
                  value={member.vitals.spo2.toFixed(1)}
                  unit="%"
                  baseline={profile.baseline.spo2}
                  trend={member.sensors.find((sensor) => sensor.id === 'spo2')?.trend ?? []}
                  color={SENSORS.spo2.color}
                />
                <Measure
                  label="Skin temp"
                  value={member.vitals.temp.toFixed(2)}
                  unit="°C"
                  baseline={profile.baseline.temp}
                  trend={member.sensors.find((sensor) => sensor.id === 'temp')?.trend ?? []}
                  color={SENSORS.temp.color}
                />
                <Measure
                  label="Recovery"
                  value={member.vitals.sleep.toFixed(0)}
                  unit="/100"
                  baseline={profile.baseline.sleep}
                  trend={member.sensors.find((sensor) => sensor.id === 'sleep')?.trend ?? []}
                  color={SENSORS.sleep.color}
                />
              </div>

              <div className="flex flex-1 flex-col justify-between gap-2 px-4 py-3">
                <p className="text-[9.5px] leading-relaxed text-muted">{profile.summary}</p>
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-micro text-muted/70">
                  <UserRound size={9} /> independent buffer · no cross-profile mixing
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel
        eyebrow="Profile isolation contract"
        title="How switching works"
        bodyClassName="p-3"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['One engine per astronaut', 'Each profile has its own simulation engine, clock, rolling buffers and anomaly log. Switching changes the active engine, not a shared view.'],
            ['Per-profile baseline', 'Baseline HR, HRV, SpO₂, skin temperature, activity and recovery are stored on the profile and used for every deviation calculation.'],
            ['Per-profile evidence', 'Anomalies, witness channels, window errors and events are read from that profile only. No values are averaged or merged between crew members.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded border border-line-soft bg-base/30 p-2.5">
              <div className="font-mono text-[8.5px] uppercase tracking-micro text-cyan">{title}</div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Measure({
  label,
  value,
  unit,
  baseline,
  trend,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  baseline: number;
  trend: number[];
  color: string;
}) {
  return (
    <div className="bg-panel px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted">{label}</span>
        <span className="font-mono text-[7.5px] text-muted/60">base {baseline}</span>
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-1">
        <span className="font-mono text-[13px] tabular-nums text-ink">{value}</span>
        <span className="w-12 shrink-0">
          <Sparkline data={trend} color={color} height={16} />
        </span>
      </div>
      <div className="font-mono text-[7px] uppercase tracking-micro text-muted/60">{unit}</div>
    </div>
  );
}
