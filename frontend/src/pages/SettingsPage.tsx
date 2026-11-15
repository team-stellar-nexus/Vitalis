import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Toggle } from '@/components/ui/Toggle';
import { playAlertTone } from '@/lib/audio';
import { API_ENDPOINTS } from '@/services/contracts';
import { SCENARIO_LIST } from '@/simulation/scenarios';
import { useSettings, type ThemeId } from '@/state/SettingsProvider';
import { useTelemetry } from '@/state/TelemetryProvider';
import { useVitalisBackend } from '@/state/VitalisBackendProvider';
import { cn } from '@/lib/utils';
import { Check, Copy, Palette, Plug, RotateCcw, ShieldAlert, SlidersHorizontal, Volume2 } from 'lucide-react';
import { useState } from 'react';

const THEMES: Array<{ id: ThemeId; label: string; description: string; swatches: string[] }> = [
  {
    id: 'dark',
    label: 'Mission Deep',
    description: 'Default flight-deck palette. Balanced contrast for long shifts.',
    swatches: ['#070B14', '#101C2D', '#35D9F2'],
  },
  {
    id: 'contrast',
    label: 'High Contrast',
    description: 'Brighter hairlines and text for glare-heavy environments.',
    swatches: ['#02050A', '#091422', '#35D9F2'],
  },
  {
    id: 'night',
    label: 'Night Ops',
    description: 'Dimmed surfaces for low-light ground stations.',
    swatches: ['#05070C', '#0B131F', '#438AFF'],
  },
];

export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { snapshot, mode, setMode, pause, resume, reset: resetSimulation } = useTelemetry();
  const backend = useVitalisBackend();
  const [copied, setCopied] = useState(false);

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(API_ENDPOINTS, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operator preferences · simulation controls"
        title="System Settings"
        description="Display, telemetry cadence and demo-engine controls. Preferences persist locally in this browser; nothing is sent to a server."
        actions={
          <>
            <Badge tone={mode === 'demo' ? 'cyan' : 'amber'} dot>
              {mode === 'demo' ? 'DEMO MODE' : 'LIVE MODE'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw size={12} /> Reset preferences
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 space-y-3 xl:col-span-7">
          <Panel
            bracket
            eyebrow="Appearance"
            title="Theme & Display"
            actions={<Palette size={13} className="text-muted" />}
            bodyClassName="p-4"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {THEMES.map((theme) => {
                const active = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ theme: theme.id })}
                    className={cn(
                      'rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-cyan/45 bg-cyan/[0.07]'
                        : 'border-line bg-base/30 hover:border-cyan/25 hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-ink">{theme.label}</span>
                      {active && <Check size={12} className="text-cyan" />}
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {theme.swatches.map((color) => (
                        <span
                          key={color}
                          className="h-3 w-3 rounded-sm border border-white/10"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">{theme.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 divide-y divide-line-soft">
              <Toggle
                id="reduce-motion"
                label="Reduce motion"
                description="Disables scanning sweeps, grid drift and staggered panel entrances."
                checked={settings.reduceMotion}
                onChange={(v) => update({ reduceMotion: v })}
              />
              <Toggle
                id="show-grid"
                label="Background grid"
                description="Mission-control coordinate grid behind the workspace."
                checked={settings.showGrid}
                onChange={(v) => update({ showGrid: v })}
              />
            </div>
          </Panel>

          <Panel
            bracket
            eyebrow="Telemetry cadence"
            title="Data & Alerts"
            actions={<SlidersHorizontal size={13} className="text-muted" />}
            bodyClassName="p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label-xs mb-1.5">Chart refresh interval</div>
                <Segmented
                  label="Chart refresh interval"
                  options={[
                    { value: 500, label: '0.5s' },
                    { value: 1000, label: '1s' },
                    { value: 2000, label: '2s' },
                    { value: 5000, label: '5s' },
                  ]}
                  value={settings.refreshMs}
                  onChange={(v) => update({ refreshMs: Number(v) })}
                />
                <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                  Applies to simulated stream ticks and every chart on the dashboard.
                </p>
              </div>
              <div>
                <div className="label-xs mb-1.5">Simulation speed</div>
                <Segmented
                  label="Simulation speed"
                  options={[
                    { value: 0.5, label: '0.5×' },
                    { value: 1, label: '1×' },
                    { value: 2, label: '2×' },
                    { value: 4, label: '4×' },
                  ]}
                  value={settings.speed}
                  onChange={(v) => update({ speed: Number(v) })}
                />
                <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                  Multiplies simulated elapsed time; the UTC clock remains real.
                </p>
              </div>
            </div>

            <div className="mt-2 divide-y divide-line-soft">
              <Toggle
                id="sound-alerts"
                label="Audible anomaly alert"
                description="Two-tone chime when a simulated event is confirmed. Off by default."
                checked={settings.soundAlerts}
                onChange={(v) => update({ soundAlerts: v })}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded border border-line-soft bg-base/40 px-2.5 py-2">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-micro text-muted">
                <Volume2 size={11} /> Alert tone test
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!settings.soundAlerts}
                onClick={() => playAlertTone('confirmed')}
              >
                Play test tone
              </Button>
            </div>
          </Panel>

          <Panel
            bracket
            eyebrow="Demo engine · local simulation"
            title="Simulation Controls"
            bodyClassName="p-4"
            footer={
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                Changing scenario eases the simulated signal over several seconds
              </span>
            }
          >
            <div className="space-y-2">
              {SCENARIO_LIST.map((scenario) => {
                const active = settings.scenario === scenario.id;
                const accent =
                  scenario.accent === 'red'
                    ? 'border-red/45 bg-red/[0.07]'
                    : scenario.accent === 'amber'
                      ? 'border-amber/45 bg-amber/[0.06]'
                      : 'border-green/40 bg-green/[0.05]';
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ scenario: scenario.id })}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors',
                      active ? accent : 'border-line bg-base/30 hover:border-cyan/25',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                        scenario.accent === 'red' ? 'bg-red' : scenario.accent === 'amber' ? 'bg-amber' : 'bg-green',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium text-ink">{scenario.label}</span>
                        {active && (
                          <span className="font-mono text-[8px] uppercase tracking-micro text-cyan">running</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[9.5px] leading-relaxed text-muted">
                        {scenario.description}
                      </span>
                      <span className="mt-1 block font-mono text-[8.5px] uppercase tracking-micro text-muted/80">
                        Expected · {scenario.expected}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 divide-y divide-line-soft">
              <Toggle
                id="sensor-dropout"
                label="Simulate SpO₂ sensor dropout"
                description="Marks the channel NO DATA and removes it from witness validation."
                checked={settings.dropout}
                onChange={(v) => update({ dropout: v })}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetSimulation}>
                <RotateCcw size={12} /> Reset simulation buffers
              </Button>
              <Button variant="ghost" size="sm" onClick={snapshot.paused ? resume : pause}>
                {snapshot.paused ? 'Resume telemetry' : 'Pause telemetry'}
              </Button>
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                {snapshot.paused ? 'PAUSED' : 'RUNNING'} · tick {snapshot.simTime.toFixed(0)}s
              </span>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-3 xl:col-span-5">
          <Panel
            bracket
            eyebrow="Backend hand-off"
            title="Integration"
            actions={<Plug size={13} className="text-muted" />}
            bodyClassName="p-4"
            footer={
              <span className="font-mono text-[9px] leading-relaxed text-muted">
                Mock services remain the default until these endpoints are supplied.
              </span>
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">Data source</span>
              <Segmented
                label="Data source"
                options={[
                  { value: 'demo', label: 'Demo' },
                  { value: 'live', label: 'Live' },
                ]}
                value={mode}
                onChange={(v) => setMode(v as 'demo' | 'live')}
              />
            </div>

            <div className="mt-3 space-y-1">
              {Object.entries(API_ENDPOINTS).map(([key, path]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded border border-line-soft bg-base/40 px-2 py-1.5"
                >
                  <span className="font-mono text-[8px] uppercase tracking-micro text-muted">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="ml-auto truncate font-mono text-[9.5px] text-ink">{path}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                VITE_API_BASE_URL
              </span>
              <Badge tone="neutral">{backend.backendUrl}</Badge>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">
                FastAPI /health · /report
              </span>
              <Badge tone={backend.state === 'online' ? 'green' : 'amber'} dot>
                {backend.state}
              </Badge>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-micro text-muted">Model checkpoint</span>
              <Badge tone={backend.health?.model.loaded ? 'cyan' : 'neutral'}>
                {backend.health?.model.loaded ? `loaded · ${backend.health.model.num_classes ?? '?'} classes` : 'not loaded'}
              </Badge>
            </div>

            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={copyContract}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Contract copied' : 'Copy endpoint contract'}
            </Button>

            <div className="mt-3 rounded border border-amber/20 bg-amber/[0.04] px-2.5 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-micro text-amber">
                <ShieldAlert size={10} /> Live mode
              </div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-muted">
                Live mode posts this astronaut's last 30 s of PPG to the FastAPI backend every 15 s
                and renders the returned indicators. Fusion windows, witness channels and the
                spectrogram are still computed in the browser and are labelled simulated. Start the
                backend with <span className="font-mono">python -m uvicorn api:app --app-dir src --port 8000</span>.
              </p>
            </div>
          </Panel>

          <Panel
            bracket
            eyebrow="Read-only mission context"
            title="System Information"
            bodyClassName="p-0"
          >
            <div className="divide-y divide-line-soft">
              {[
                ['Mission', `${snapshot.mission.id} · ${snapshot.mission.vehicle}`],
                ['Astronaut', `${snapshot.astronaut.id} · ${snapshot.astronaut.role}`],
                ['Orbit', snapshot.mission.orbit],
                ['Ground relay', snapshot.mission.groundStation],
                ['Model', `${snapshot.model.name} · ${snapshot.model.architecture}`],
                ['Threshold', snapshot.model.thresholdRule],
                ['Window set', `${snapshot.model.windowSet.join(' / ')} s`],
                ['Build', 'vitalis 1.0.0 · demo-0.9.4'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 px-3 py-2">
                  <span className="w-20 shrink-0 font-mono text-[8px] uppercase tracking-micro text-muted">
                    {label}
                  </span>
                  <span className="text-right font-mono text-[9.5px] leading-relaxed text-ink">{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="rounded-lg border border-line bg-panel/40 p-3">
            <div className="label-xs mb-1">Data disclaimer</div>
            <p className="text-[10px] leading-relaxed text-muted">
              All readings, events and anomalies in this interface are synthetic. VITALIS is a
              hackathon prototype: it is not affiliated with NASA, is not connected to any astronaut,
              and does not provide medical advice. Potential autonomic stress patterns are screening
              flags inferred from signal deviations, not a measured biomarker or diagnosis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
