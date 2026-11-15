import { NexusMark, NexusWordmark } from '@/components/layout/Logo';
import { Badge, LiveDot } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import {
  Activity,
  AudioWaveform,
  Brain,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  LayoutDashboard,
  Radar,
  Settings,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Monitoring',
    items: [
      { to: '/', label: 'Mission Overview', short: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/crew', label: 'Crew Profiles', short: 'Crew', icon: Users },
      { to: '/live-monitoring', label: 'Live Monitoring', short: 'Live', icon: Activity },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/signal-analysis', label: 'Signal Analysis', short: 'Signals', icon: AudioWaveform },
      { to: '/anomaly-detection', label: 'Anomaly Detection', short: 'Anomaly', icon: Radar },
      { to: '/sensor-intelligence', label: 'Sensor Intelligence', short: 'Sensors', icon: Cpu },
      { to: '/health-intelligence', label: 'Health Intelligence', short: 'Health AI', icon: Brain },
    ],
  },
  {
    label: 'Mission',
    items: [
      { to: '/mission-reports', label: 'Mission Reports', short: 'Reports', icon: FileText },
      { to: '/settings', label: 'System Settings', short: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { snapshot, mode } = useTelemetry();
  const navigate = useNavigate();
  const health = snapshot.health;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[252px] shrink-0 flex-col border-r border-line bg-[#080E19]/95 transition-[transform,width] duration-300 ease-expo lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]',
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-[58px] items-center gap-2.5 border-b border-line px-3.5">
          <NexusMark size={30} className="shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <NexusWordmark />
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="ml-auto hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent text-muted transition-colors hover:border-line hover:bg-white/5 hover:text-ink lg:flex"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded border border-line text-muted hover:text-ink lg:hidden"
          >
            <X size={14} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 no-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              {!collapsed ? (
                <div className="label-xs mb-1.5 px-2 text-muted/70">{group.label}</div>
              ) : (
                <div className="mx-2 mb-2 h-px bg-line" />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-[34px] items-center gap-2.5 rounded px-2 text-[12px] transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-gradient-to-r from-cyan/[0.14] to-transparent text-ink'
                            : 'text-muted hover:bg-white/[0.04] hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-cyan shadow-[0_0_10px_rgba(53,217,242,0.7)]" />
                          )}
                          <item.icon
                            size={15}
                            className={cn('shrink-0 transition-colors', isActive ? 'text-cyan' : 'text-muted group-hover:text-ink')}
                          />
                          {!collapsed && (
                            <span className="truncate font-medium tracking-tight">{item.label}</span>
                          )}
                          {!collapsed && isActive && (
                            <span className="ml-auto font-mono text-[8px] uppercase tracking-micro text-cyan/70">
                              ●
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          {!collapsed ? (
            <div className="rounded border border-line bg-base/60 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label-xs">System link</span>
                <LiveDot tone={mode === 'demo' ? 'cyan' : health.link === 'nominal' ? 'green' : 'amber'} />
              </div>
              <div className="space-y-1 font-mono text-[9px] text-muted">
                <div className="flex justify-between">
                  <span>LINK</span>
                  <span className="text-ink">{mode === 'demo' ? 'SIMULATED' : health.link.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>LATENCY</span>
                  <span className="text-ink">{health.latencyMs} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>SENSORS</span>
                  <span className={health.channelsOnline < health.channelsTotal ? 'text-amber' : 'text-ink'}>
                    {health.channelsOnline}/{health.channelsTotal}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge tone="cyan" dot pulse>
                  {mode === 'demo' ? 'Demo mode' : 'Live mode'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1" title="Simulated telemetry link">
              <Wifi size={13} className="text-green" />
              <span className="h-1 w-1 rounded-full bg-cyan anim-pulse-dot" />
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className={cn(
              'mt-2 flex w-full items-center gap-2 rounded border border-transparent p-1.5 text-left transition-colors hover:border-line hover:bg-white/[0.04]',
              collapsed && 'justify-center',
            )}
            title="Mission Control Operator · open settings"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cyan/25 bg-cyan/10 font-mono text-[10px] font-medium text-cyan">
              MC
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-ink">
                  Mission Control Operator
                </span>
                <span className="flex items-center gap-1 truncate font-mono text-[8.5px] uppercase tracking-micro text-muted">
                  <ShieldCheck size={9} className="text-green" /> Flight Surgeon · Demo
                </span>
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
