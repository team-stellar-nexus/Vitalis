import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import type { PhysiologicalBaseline } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Activity, ArrowUpRight, HeartPulse, Moon, Thermometer, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

type SystemId = 'cardiovascular' | 'oxygenation' | 'thermal' | 'recovery';
type Tone = 'green' | 'amber' | 'red';

interface BodySystem {
  id: SystemId;
  label: string;
  short: string;
  channels: string;
  icon: LucideIcon;
  color: string;
  x: number;
  y: number;
  tone: Tone;
  severity: 'NOMINAL' | 'WATCH' | 'MONITOR';
  measurement: string;
  current: string;
  baseline: string;
  deviation: string;
  concern: string;
  evidence: string[];
  action: string;
}

const deltaText = (value: number, digits = 1) =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;

export function HumanBodyIntelligence() {
  const { snapshot } = useTelemetry();
  const gradientId = useId().replace(/:/g, '');
  const [selected, setSelected] = useState<SystemId>('cardiovascular');
  const baseline: PhysiologicalBaseline = snapshot.astronaut.baseline;
  const vitals = snapshot.vitals;
  const witnessLabels = snapshot.fusion.witnesses.map((id) => id.toUpperCase());
  const hrvDelta = vitals.hrv - baseline.hrv;
  const hrDelta = vitals.hr - baseline.hr;
  const spo2Delta = vitals.spo2 - baseline.spo2;
  const tempDelta = vitals.temp - baseline.temp;
  const sleepDelta = vitals.sleep - baseline.sleep;
  const activityDelta = vitals.activity - baseline.activity;
  const cardiovascularFlag = hrvDelta < -6 || hrDelta > 8 || snapshot.anomaly.status !== 'normal';
  const oxygenationFlag = spo2Delta < -0.8 || vitals.spo2 < 95;
  const thermalFlag = tempDelta > 0.25;
  const recoveryFlag = sleepDelta < -8 || activityDelta < -12;
  const flaggedCount = snapshot.fusion.flaggedCount;

  const systems: BodySystem[] = [
    {
      id: 'cardiovascular',
      label: 'Cardiovascular',
      short: 'CARDIO',
      channels: 'HR · HRV',
      icon: HeartPulse,
      color: '#35D9F2',
      x: 98,
      y: 137,
      tone: cardiovascularFlag ? (snapshot.anomaly.status === 'confirmed' ? 'red' : 'amber') : 'green',
      severity: cardiovascularFlag ? (snapshot.anomaly.status === 'confirmed' ? 'MONITOR' : 'WATCH') : 'NOMINAL',
      measurement: 'Heart rate / HRV',
      current: `${vitals.hr.toFixed(0)} BPM / ${vitals.hrv.toFixed(0)} ms`,
      baseline: `${baseline.hr} BPM / ${baseline.hrv} ms`,
      deviation: `${deltaText(hrDelta, 0)} BPM / ${deltaText(hrvDelta, 0)} ms`,
      concern: cardiovascularFlag
        ? 'Potential autonomic stress pattern from a sustained HRV deviation. Screening flag only.'
        : 'No cardiovascular baseline anomaly in the current window set.',
      evidence: [
        `HRV ${vitals.hrv.toFixed(0)} ms vs personal baseline ${baseline.hrv} ms (${deltaText(hrvDelta, 0)} ms).`,
        `Fusion: ${flaggedCount}/4 windows flagged · witness channels ${witnessLabels.length ? witnessLabels.join(', ') : 'none co-affected'}.`,
      ],
      action:
        'Continue 120 s / 240 s fusion monitoring, compare the next HRV window, and ask the flight surgeon to review if the deviation persists.',
    },
    {
      id: 'oxygenation',
      label: 'Oxygenation',
      short: 'SpO₂',
      channels: 'SpO₂',
      icon: Wind,
      color: '#438AFF',
      x: 127,
      y: 125,
      tone: oxygenationFlag ? 'amber' : 'green',
      severity: oxygenationFlag ? 'WATCH' : 'NOMINAL',
      measurement: 'Peripheral oxygen saturation',
      current: `${vitals.spo2.toFixed(1)} %`,
      baseline: `${baseline.spo2.toFixed(1)} %`,
      deviation: `${deltaText(spo2Delta, 1)} %`,
      concern: oxygenationFlag
        ? 'Oxygenation is below the personal baseline band. Verify acquisition before interpreting.'
        : 'Oxygenation remains inside the personal baseline band.',
      evidence: [
        `SpO₂ ${vitals.spo2.toFixed(1)}% vs baseline ${baseline.spo2.toFixed(1)}% (${deltaText(spo2Delta, 1)}%).`,
        snapshot.sensors.find((sensor) => sensor.id === 'spo2')?.status === 'nodata'
          ? 'SpO₂ channel is marked NO DATA; witness validation has fewer channels.'
          : 'Dual-wavelength optical channel is online and contributing to witness validation.',
      ],
      action:
        'Verify sensor contact and perfusion, repeat acquisition, and watch the 120 s trend. Do not treat a single low reading as a diagnosis.',
    },
    {
      id: 'thermal',
      label: 'Thermal',
      short: 'TEMP',
      channels: 'Skin temperature',
      icon: Thermometer,
      color: '#FFB84D',
      x: 110,
      y: 177,
      tone: thermalFlag ? 'amber' : 'green',
      severity: thermalFlag ? 'WATCH' : 'NOMINAL',
      measurement: 'Skin temperature',
      current: `${vitals.temp.toFixed(2)} °C`,
      baseline: `${baseline.temp.toFixed(2)} °C`,
      deviation: `${deltaText(tempDelta, 2)} °C`,
      concern: thermalFlag
        ? 'Thermal baseline deviation may support a multi-channel pattern. Skin temperature is not core temperature.'
        : 'Skin temperature is within the personal baseline band.',
      evidence: [
        `Sternum thermistor ${vitals.temp.toFixed(2)} °C vs baseline ${baseline.temp.toFixed(2)} °C.`,
        witnessLabels.includes('TEMP')
          ? 'TEMP is co-affected in the current fusion window.'
          : 'TEMP is not currently a supporting witness channel.',
      ],
      action:
        'Recheck thermistor placement and trend the 240 s window. Interpret only alongside the other channels; no treatment is inferred.',
    },
    {
      id: 'recovery',
      label: 'Recovery',
      short: 'RECOVERY',
      channels: 'Sleep · activity',
      icon: Moon,
      color: '#9675FF',
      x: 110,
      y: 218,
      tone: recoveryFlag ? 'amber' : 'green',
      severity: recoveryFlag ? 'WATCH' : 'NOMINAL',
      measurement: 'Sleep / recovery index and activity',
      current: `${vitals.sleep.toFixed(0)}/100 · ${vitals.activity.toFixed(0)} idx`,
      baseline: `${baseline.sleep}/100 · ${baseline.activity} idx`,
      deviation: `${deltaText(sleepDelta, 0)} / ${deltaText(activityDelta, 0)}`,
      concern: recoveryFlag
        ? 'Recovery indicators are below the personal baseline. This is an aggregate monitoring signal, not a diagnosis.'
        : 'Recovery indicators are within the personal baseline band.',
      evidence: [
        `Sleep/recovery ${vitals.sleep.toFixed(0)}/100 vs baseline ${baseline.sleep}/100.`,
        `Activity ${vitals.activity.toFixed(0)} idx vs baseline ${baseline.activity} idx; daily aggregate, not continuous telemetry.`,
      ],
      action:
        'Track the next sleep aggregate and daytime activity trend. Keep the recommendation monitoring-oriented; do not infer a sleep disorder.',
    },
  ];

  const active = systems.find((system) => system.id === selected) ?? systems[0];
  const ActiveIcon = active.icon;

  return (
    <Panel
      bracket
      eyebrow="Human body intelligence · sensor topology"
      title="Physiological Systems"
      actions={
        <>
          <Badge tone="neutral">4 systems</Badge>
          <Badge tone={snapshot.anomaly.status === 'normal' ? 'green' : snapshot.anomaly.status === 'suspected' ? 'amber' : 'red'} dot>
            {snapshot.anomaly.status === 'normal' ? 'baseline' : 'deviation'}
          </Badge>
        </>
      }
      className="h-full"
      bodyClassName="p-0"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8.5px] uppercase tracking-micro text-muted">
          <span>Select a node · baseline comparisons are per astronaut</span>
          <Link to="/sensor-intelligence" className="flex items-center gap-1 text-cyan hover:underline">
            Channel detail <ArrowUpRight size={10} />
          </Link>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden border-b border-line-soft bg-[radial-gradient(ellipse_at_50%_42%,rgba(53,217,242,0.1),transparent_66%)] lg:min-h-[470px] lg:border-b-0 lg:border-r">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(53,217,242,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(53,217,242,0.16) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage: 'radial-gradient(ellipse at 50% 46%, black 20%, transparent 76%)',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="anim-scan absolute inset-x-8 h-24 bg-gradient-to-b from-transparent via-cyan/[0.08] to-transparent" />
          </div>
          <span className="absolute left-3 top-2.5 font-mono text-[8px] uppercase tracking-micro text-muted/70">
            Fig. 02 · body intelligence
          </span>
          <span className="absolute right-3 top-2.5 flex items-center gap-1 font-mono text-[8px] uppercase tracking-micro text-muted/70">
            <Activity size={9} /> live map
          </span>

          <svg
            viewBox="0 0 220 380"
            className="relative h-[360px] w-auto max-w-full sm:h-[445px]"
            role="img"
            aria-label={`Human silhouette with four selectable physiological systems. Selected: ${active.label}.`}
          >
            <defs>
              <linearGradient id={`hb-body-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.16" />
                <stop offset="55%" stopColor="#438AFF" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#9675FF" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id={`hb-limb-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#438AFF" stopOpacity="0.2" />
              </linearGradient>
              <radialGradient id={`hb-core-${gradientId}`}>
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#35D9F2" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="110" cy="215" rx="43" ry="68" fill={`url(#hb-core-${gradientId})`} />
            <ellipse cx="110" cy="366" rx="42" ry="5" fill="#35D9F2" opacity="0.08" />

            <ellipse cx="110" cy="51" rx="21" ry="25" fill={`url(#hb-body-${gradientId})`} stroke="#35D9F2" strokeOpacity="0.45" strokeWidth="0.9" />
            <path d="M99 73 L99 87 Q110 95 121 87 L121 73" fill={`url(#hb-body-${gradientId})`} stroke="#35D9F2" strokeOpacity="0.32" strokeWidth="0.7" />
            <path
              d="M93 88 C76 94 67 109 64 128 L60 194 C59 207 68 214 80 215 L140 215 C152 214 161 207 160 194 L156 128 C153 109 144 94 127 88 Z"
              fill={`url(#hb-body-${gradientId})`}
              stroke="#35D9F2"
              strokeOpacity="0.4"
              strokeWidth="0.9"
            />
            <path d="M80 113 Q110 122 140 113 M78 130 Q110 139 142 130 M77 147 Q110 156 143 147 M74 188 Q110 199 146 188" fill="none" stroke="#35D9F2" strokeOpacity="0.13" strokeWidth="0.55" />
            <path d="M110 95 L110 211" fill="none" stroke="#35D9F2" strokeOpacity="0.32" strokeWidth="0.7" className="anim-dash" />

            <path d="M91 94 C79 105 71 128 65 152 L58 181" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="12" strokeLinecap="round" />
            <path d="M58 181 C54 195 52 206 51 216" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="9.5" strokeLinecap="round" />
            <ellipse cx="50" cy="224" rx="5" ry="7.5" fill="rgba(67,138,255,0.14)" stroke="#438AFF" strokeOpacity="0.4" strokeWidth="0.6" />
            <path d="M129 94 C141 105 149 128 155 152 L162 181" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="12" strokeLinecap="round" />
            <path d="M162 181 C166 195 168 206 169 216" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="9.5" strokeLinecap="round" />
            <ellipse cx="170" cy="224" rx="5" ry="7.5" fill="rgba(67,138,255,0.14)" stroke="#438AFF" strokeOpacity="0.4" strokeWidth="0.6" />

            <path d="M92 215 L89 270 L85 322 L82 354" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="16" strokeLinecap="round" />
            <ellipse cx="81" cy="362" rx="8" ry="4.5" fill="rgba(67,138,255,0.15)" stroke="#438AFF" strokeOpacity="0.36" strokeWidth="0.6" />
            <path d="M128 215 L131 270 L135 322 L138 354" fill="none" stroke={`url(#hb-limb-${gradientId})`} strokeWidth="16" strokeLinecap="round" />
            <ellipse cx="139" cy="362" rx="8" ry="4.5" fill="rgba(67,138,255,0.15)" stroke="#438AFF" strokeOpacity="0.36" strokeWidth="0.6" />

            <path d="M107 135 C99 128 95 122 99 118 C101.5 114.5 106 115.5 108 119.5 C110 115.5 114.5 114.5 117 118 C121 122 117 128 107 135 Z" fill="rgba(53,217,242,0.24)" stroke="#35D9F2" strokeOpacity="0.9" strokeWidth="0.8" className="anim-heart" />
            <path d="M93 126 C86 126 83 132 86 137 C89 141 95 140 97 135 C99 140 105 141 108 137 C111 132 108 126 101 126 Z" fill="rgba(67,138,255,0.12)" stroke="#438AFF" strokeOpacity="0.55" strokeWidth="0.6" />
            <path d="M104 169 L114 169 L117 176 L114 183 L104 183 L101 176 Z" fill="rgba(255,184,77,0.12)" stroke="#FFB84D" strokeOpacity="0.55" strokeWidth="0.6" />
            <circle cx="109" cy="176" r="1.7" fill="#FFB84D" opacity="0.85" />
            <circle cx="110" cy="211" r="5" fill="rgba(150,117,255,0.12)" stroke="#9675FF" strokeOpacity="0.55" strokeWidth="0.7" />
            <path d="M106 211 Q110 207 114 211 Q110 215 106 211 Z" fill="#9675FF" opacity="0.6" />

            {systems.map((system, index) => {
              const activeNode = system.id === selected;
              return (
                <g
                  key={system.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${system.label}: ${system.current}. ${system.concern}`}
                  aria-pressed={activeNode}
                  onClick={() => setSelected(system.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(system.id);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={system.x} cy={system.y} r="17" fill="transparent" />
                  <circle cx={system.x} cy={system.y} r="12" fill={system.color} fillOpacity={activeNode ? 0.2 : 0.06} stroke={activeNode ? system.color : 'transparent'} strokeOpacity="0.7" strokeWidth="0.8" />
                  <circle
                    cx={system.x}
                    cy={system.y}
                    r={activeNode ? 7 : 5}
                    fill="none"
                    stroke={system.color}
                    strokeOpacity="0.8"
                    strokeWidth="1"
                    style={{ transformOrigin: `${system.x}px ${system.y}px`, animation: `pulse-ring 3.4s ease-out ${index * 0.7}s infinite` }}
                  />
                  <circle cx={system.x} cy={system.y} r="2.5" fill={system.color} />
                </g>
              );
            })}

            <g fill="#8296AD" fontFamily="JetBrains Mono, monospace" fontSize="4.4" letterSpacing="0.4">
              <line x1="88" y1="133" x2="36" y2="126" stroke="#8296AD" strokeOpacity="0.26" strokeWidth="0.4" />
              <text x="5" y="125">CARDIO</text>
              <line x1="135" y1="121" x2="174" y2="112" stroke="#8296AD" strokeOpacity="0.26" strokeWidth="0.4" />
              <text x="177" y="111">SpO₂</text>
              <line x1="122" y1="177" x2="174" y2="170" stroke="#8296AD" strokeOpacity="0.26" strokeWidth="0.4" />
              <text x="177" y="169">THERMAL</text>
              <line x1="120" y1="219" x2="174" y2="225" stroke="#8296AD" strokeOpacity="0.26" strokeWidth="0.4" />
              <text x="177" y="226">RECOVERY</text>
            </g>
          </svg>

          <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap gap-1.5">
            {systems.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => setSelected(system.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded border px-1.5 py-1 font-mono text-[8px] uppercase tracking-micro transition-colors',
                  selected === system.id
                    ? 'border-cyan/35 bg-cyan/[0.08] text-ink'
                    : 'border-line bg-base/50 text-muted hover:text-ink',
                )}
              >
                <span className={cn('h-1 w-1 rounded-full', system.tone === 'red' ? 'bg-red' : system.tone === 'amber' ? 'bg-amber' : 'bg-green')} />
                {system.short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="border-b border-line-soft px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="label-xs mb-1 flex items-center gap-1.5">
                  <ActiveIcon size={11} style={{ color: active.color }} />
                  {active.channels} · selected region
                </div>
                <h3 className="font-display text-[16px] font-semibold tracking-tight text-ink">{active.label}</h3>
              </div>
              <Badge tone={active.tone} dot>
                {active.severity}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Readout label="Measurement" value={active.measurement} />
              <Readout label="Current" value={active.current} />
              <Readout label="Personal baseline" value={active.baseline} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded border border-line-soft bg-base/35 px-2.5 py-1.5">
              <span className="font-mono text-[8px] uppercase tracking-micro text-muted">Deviation</span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: active.color }}>{active.deviation}</span>
              <span className="font-mono text-[7.5px] uppercase tracking-micro text-muted/60">vs personal baseline</span>
            </div>
          </div>

          <div className="space-y-3 px-4 py-3">
            <div>
              <div className="label-xs mb-1.5">Possible physiological concern</div>
              <p className="text-[10.5px] leading-relaxed text-ink/90">{active.concern}</p>
              <p className="mt-1 font-mono text-[7.5px] uppercase tracking-micro text-amber/80">
                Screening flag · not a confirmed medical diagnosis
              </p>
            </div>

            <div>
              <div className="label-xs mb-1.5">Supporting evidence</div>
              <ul className="space-y-1">
                {active.evidence.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[9.5px] leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border border-cyan/15 bg-cyan/[0.035] px-2.5 py-2">
              <div className="font-mono text-[8px] uppercase tracking-micro text-cyan">Suggested monitoring action</div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{active.action}</p>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-base/40 px-2 py-1.5">
      <div className="truncate font-mono text-[7.5px] uppercase tracking-micro text-muted">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] leading-tight text-ink">{value}</div>
    </div>
  );
}
