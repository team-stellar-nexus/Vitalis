import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight, Brain, HeartPulse, ScanLine, Zap } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Tone = 'neutral' | 'cyan' | 'blue' | 'violet' | 'green' | 'amber' | 'red';

interface SensorNode {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  short: string;
  value: string;
  source: string;
  note: string;
  status: string;
  tone: Tone;
  align: 'left' | 'center';
}

/**
 * Section C — central physiological intelligence.
 *
 * The figure is a schematic: sensor nodes mark where a wearable pack would sit
 * and the metabolic reading is explicitly an inference. Hovering, focusing or
 * tapping a node pins its provenance card.
 */
export function BodyMap() {
  const { snapshot } = useTelemetry();
  const gradientId = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const status = snapshot.anomaly.status;
  const risk = snapshot.anomaly.score;
  const riskLabel = status === 'confirmed' ? 'ELEVATED' : status === 'suspected' ? 'WATCH' : 'LOW';
  const riskTone = status === 'confirmed' ? 'text-red' : status === 'suspected' ? 'text-amber' : 'text-green';
  const riskBg = status === 'confirmed' ? 'bg-red' : status === 'suspected' ? 'bg-amber' : 'bg-green';
  const neuroScore = Math.round(snapshot.vitals.sleep * 0.65 + snapshot.vitals.activity * 0.35);
  const cardiacNote =
    snapshot.vitals.hr > 84 ? 'Elevated demand' : snapshot.vitals.hr < 60 ? 'Bradycardic trend' : 'Regular rhythm';

  const nodes: SensorNode[] = [
    {
      id: 'neuro',
      x: 110,
      y: 46,
      color: '#9675FF',
      label: 'Cortical proxy',
      short: 'NEURAL',
      value: `${neuroScore} / 100`,
      source: 'Sleep + activity proxy · simulated',
      note: 'A derived index only. No cortical or neural signal is measured by the demo pack.',
      status: 'PROXY',
      tone: 'violet',
      align: 'center',
    },
    {
      id: 'cardiac',
      x: 108,
      y: 133,
      color: '#35D9F2',
      label: 'Cardiac node',
      short: 'CARDIAC',
      value: `${snapshot.vitals.hr} BPM · ${snapshot.vitals.hrv} ms HRV`,
      source: 'PPG · R-R derived',
      note: 'R-R intervals drive the variability index; the displayed cardiac shape is synthetic.',
      status: cardiacNote.toUpperCase(),
      tone: snapshot.vitals.hr > 84 ? 'amber' : 'green',
      align: 'center',
    },
    {
      id: 'metabolic',
      x: 108,
      y: 178,
      color: '#FFB84D',
      label: 'Metabolic inference',
      short: 'METAB',
      value: `Risk ${risk} / 100`,
      source: 'Multi-channel reconstruction inference',
      note: 'Inferred from signal deviations. This is not a direct biomarker measurement.',
      status: riskLabel,
      tone: status === 'confirmed' ? 'red' : status === 'suspected' ? 'amber' : 'green',
      align: 'center',
    },
    {
      id: 'ppg',
      x: 51,
      y: 214,
      color: '#438AFF',
      label: 'PPG wrist node',
      short: 'PPG',
      value: `SpO₂ ${snapshot.vitals.spo2.toFixed(1)} %`,
      source: 'Optical · 50 Hz demo buffer',
      note: 'Wrist optical node carrying pulse and oxygen saturation. Values are simulated.',
      status: 'SIGNAL OK',
      tone: 'cyan',
      align: 'left',
    },
  ];

  const shownId = pinned ?? hovered;
  const activeNode = nodes.find((node) => node.id === shownId) ?? null;

  return (
    <Panel
      bracket
      eyebrow="Central system model · schematic"
      title="Physiological Intelligence"
      actions={
        <>
          <Badge tone="neutral">4 nodes</Badge>
          <StatusBadge status={status} />
        </>
      }
      className="h-full"
      bodyClassName="p-0"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-micro text-muted">
          <span>HRV / PPG primary · 0.5–8 Hz · simulated</span>
          <Link
            to="/sensor-intelligence"
            className="flex items-center gap-1 text-cyan hover:underline"
          >
            Sensor detail <ArrowUpRight size={10} />
          </Link>
        </div>
      }
    >
      <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative flex min-h-[370px] items-center justify-center bg-[radial-gradient(ellipse_at_50%_38%,rgba(53,217,242,0.09),transparent_64%)] sm:min-h-[470px] sm:border-r sm:border-line-soft">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.24]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(53,217,242,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(53,217,242,0.16) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
              maskImage: 'radial-gradient(ellipse at 50% 46%, black 22%, transparent 74%)',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="anim-scan absolute inset-x-5 h-20 bg-gradient-to-b from-transparent via-cyan/[0.09] to-transparent" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/25 to-transparent" />
          </div>

          <span className="absolute left-2.5 top-2.5 font-mono text-[8px] uppercase tracking-micro text-muted/70">
            Fig. 01 · sensor topology
          </span>
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 font-mono text-[8px] uppercase tracking-micro text-muted/70">
            <ScanLine size={9} /> scanning
          </span>
          <span className="absolute bottom-2.5 left-2.5 font-mono text-[8px] uppercase tracking-micro text-muted/70">
            PPG + HRV wearable pack
          </span>
          <span className="absolute bottom-2.5 right-2.5 font-mono text-[7.5px] uppercase tracking-micro text-muted/60">
            {pinned ? 'pinned · tap to release' : 'hover / tap nodes'}
          </span>

          <svg
            viewBox="0 0 220 380"
            className="relative h-[360px] w-auto max-w-full sm:h-[470px]"
            role="img"
            aria-label="Detailed human silhouette with four interactive biological sensor nodes"
          >
            <defs>
              <linearGradient id={`body-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.17" />
                <stop offset="55%" stopColor="#438AFF" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#9675FF" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id={`limb-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#438AFF" stopOpacity="0.24" />
              </linearGradient>
              <radialGradient id={`core-${gradientId}`}>
                <stop offset="0%" stopColor="#35D9F2" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#35D9F2" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="110" cy="214" rx="42" ry="66" fill={`url(#core-${gradientId})`} />
            <ellipse cx="110" cy="368" rx="42" ry="5" fill="#35D9F2" opacity="0.08" />

            {/* head */}
            <ellipse
              cx="110"
              cy="52"
              rx="21"
              ry="24"
              fill={`url(#body-${gradientId})`}
              stroke="#35D9F2"
              strokeOpacity="0.45"
              strokeWidth="0.9"
            />
            <path
              d="M90 54 C90 68 97 78 110 80 C123 78 130 68 130 54"
              fill="none"
              stroke="#35D9F2"
              strokeOpacity="0.22"
              strokeWidth="0.7"
            />
            <path d="M104 77 L104 87 M116 77 L116 87" stroke="#35D9F2" strokeOpacity="0.28" strokeWidth="0.6" />
            <ellipse cx="88.5" cy="54" rx="2" ry="4" fill="none" stroke="#35D9F2" strokeOpacity="0.3" strokeWidth="0.6" />
            <ellipse cx="131.5" cy="54" rx="2" ry="4" fill="none" stroke="#35D9F2" strokeOpacity="0.3" strokeWidth="0.6" />

            {/* brain glyph */}
            <path
              d="M104 52 C98 50 97 44 101.5 42 C100.5 36.5 107 33.5 111 37 C113 31.5 121 32.5 122 38 C127.5 39 127.5 46 123 48.5 C124 54 117 57 113 53.5 C109 57 102.5 56 104 52 Z"
              fill="rgba(150,117,255,0.14)"
              stroke="#9675FF"
              strokeOpacity="0.6"
              strokeWidth="0.7"
            />
            <path
              d="M110 35.5 L110 55 M103.5 42 Q110 45.5 117 42 M105 49 Q110 51 115 48.5"
              fill="none"
              stroke="#9675FF"
              strokeOpacity="0.35"
              strokeWidth="0.4"
            />

            {/* neck */}
            <path
              d="M99 73 L99 88 Q110 96 121 88 L121 73"
              fill={`url(#body-${gradientId})`}
              stroke="#35D9F2"
              strokeOpacity="0.32"
              strokeWidth="0.7"
            />

            {/* torso */}
            <path
              d="M94 88 C77 94 67 109 64 128 L60 194 C59 207 68 215 80 216 L140 216 C152 215 161 207 160 194 L156 128 C153 109 143 94 126 88 Z"
              fill={`url(#body-${gradientId})`}
              stroke="#35D9F2"
              strokeOpacity="0.4"
              strokeWidth="0.9"
            />
            <path d="M96 92 Q110 100 124 92" fill="none" stroke="#35D9F2" strokeOpacity="0.25" strokeWidth="0.6" />
            <path d="M82 113 Q110 122 138 113" fill="none" stroke="#35D9F2" strokeOpacity="0.16" strokeWidth="0.55" />
            <path d="M79 130 Q110 139 141 130" fill="none" stroke="#35D9F2" strokeOpacity="0.14" strokeWidth="0.55" />
            <path d="M77 147 Q110 156 143 147" fill="none" stroke="#35D9F2" strokeOpacity="0.12" strokeWidth="0.55" />
            <path d="M73 188 Q110 199 147 188" fill="none" stroke="#35D9F2" strokeOpacity="0.14" strokeWidth="0.55" />
            <path d="M110 96 L110 212" fill="none" stroke="#35D9F2" strokeOpacity="0.35" strokeWidth="0.7" className="anim-dash" />

            {/* arms */}
            <path
              d="M91 94 C79 105 71 128 65 152 L58 181"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M58 181 C54 195 52 206 51 216"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="9.5"
              strokeLinecap="round"
            />
            <ellipse cx="50" cy="224" rx="5" ry="7.5" fill="rgba(67,138,255,0.14)" stroke="#438AFF" strokeOpacity="0.4" strokeWidth="0.6" />
            <circle cx="65" cy="152" r="1.6" fill="#35D9F2" opacity="0.3" />

            <path
              d="M129 94 C141 105 149 128 155 152 L162 181"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M162 181 C166 195 168 206 169 216"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="9.5"
              strokeLinecap="round"
            />
            <ellipse cx="170" cy="224" rx="5" ry="7.5" fill="rgba(67,138,255,0.14)" stroke="#438AFF" strokeOpacity="0.4" strokeWidth="0.6" />
            <circle cx="155" cy="152" r="1.6" fill="#35D9F2" opacity="0.3" />

            {/* legs */}
            <path
              d="M92 216 L89 270 L85 322"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M85 322 L82 354"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="11"
              strokeLinecap="round"
            />
            <ellipse cx="81" cy="362" rx="8" ry="4.5" fill="rgba(67,138,255,0.15)" stroke="#438AFF" strokeOpacity="0.36" strokeWidth="0.6" />
            <circle cx="88.5" cy="270" r="2" fill="none" stroke="#35D9F2" strokeOpacity="0.3" strokeWidth="0.5" />

            <path
              d="M128 216 L131 270 L135 322"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M135 322 L138 354"
              fill="none"
              stroke={`url(#limb-${gradientId})`}
              strokeWidth="11"
              strokeLinecap="round"
            />
            <ellipse cx="139" cy="362" rx="8" ry="4.5" fill="rgba(67,138,255,0.15)" stroke="#438AFF" strokeOpacity="0.36" strokeWidth="0.6" />
            <circle cx="131.5" cy="270" r="2" fill="none" stroke="#35D9F2" strokeOpacity="0.3" strokeWidth="0.5" />

            {/* heart glyph */}
            <path
              d="M108 141 C100 134 96 128 99.5 124 C102 120.5 106.5 121.5 108 125.5 C109.5 121.5 114 120.5 116.5 124 C120 128 116 134 108 141 Z"
              fill="rgba(53,217,242,0.24)"
              stroke="#35D9F2"
              strokeOpacity="0.9"
              strokeWidth="0.8"
              className="anim-heart"
            />

            {/* metabolic glyph */}
            <path
              d="M108 168 L114.5 171.5 L114.5 179 L108 182.5 L101.5 179 L101.5 171.5 Z"
              fill="rgba(255,184,77,0.12)"
              stroke="#FFB84D"
              strokeOpacity="0.55"
              strokeWidth="0.6"
            />
            <circle cx="108" cy="175.5" r="1.6" fill="#FFB84D" opacity="0.85" />

            {/* signal pathways / connector lines */}
            <path
              d="M110 60 L110 118"
              fill="none"
              stroke="#9675FF"
              strokeOpacity="0.35"
              strokeWidth="0.6"
              className="anim-dash"
            />
            <path
              d="M110 58 C124 78 122 106 112 120"
              fill="none"
              stroke="#9675FF"
              strokeOpacity="0.2"
              strokeWidth="0.6"
              strokeDasharray="2 4"
            />
            <path
              d="M108 138 C98 158 80 182 53 207"
              fill="none"
              stroke="#35D9F2"
              strokeOpacity="0.22"
              strokeWidth="0.6"
              className="anim-dash"
            />
            <path
              d="M108 138 C112 156 116 176 113 196"
              fill="none"
              stroke="#FFB84D"
              strokeOpacity="0.16"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />

            {/* scan rings */}
            <circle cx="110" cy="52" r="31" fill="none" stroke="#9675FF" strokeOpacity="0.18" strokeDasharray="2 5" strokeWidth="0.6" className="anim-dash" />
            <ellipse cx="108" cy="133" rx="28" ry="21" fill="none" stroke="#35D9F2" strokeOpacity="0.16" strokeDasharray="2 5" strokeWidth="0.6" className="anim-dash" />

            {/* interactive sensor nodes */}
            {nodes.map((node, index) => {
              const active = shownId === node.id;
              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label}: ${node.value}. ${node.source}.`}
                  aria-pressed={pinned === node.id}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(node.id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setPinned((current) => (current === node.id ? null : node.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setPinned((current) => (current === node.id ? null : node.id));
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={node.x} cy={node.y} r="16" fill="transparent" />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="11"
                    fill={node.color}
                    fillOpacity={active ? 0.18 : 0.06}
                    stroke={active ? node.color : 'transparent'}
                    strokeOpacity="0.6"
                    strokeWidth="0.5"
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="6"
                    fill="none"
                    stroke={node.color}
                    strokeOpacity="0.6"
                    strokeWidth="0.9"
                    style={{
                      transformOrigin: `${node.x}px ${node.y}px`,
                      animation: `pulse-ring 3.4s ease-out ${index * 0.9}s infinite`,
                    }}
                  />
                  <circle cx={node.x} cy={node.y} r="2.6" fill={node.color} />
                </g>
              );
            })}

            {/* leader labels */}
            <g fill="#8296AD" fontFamily="JetBrains Mono, monospace" fontSize="4.6" letterSpacing="0.4">
              <line x1="118" y1="44" x2="166" y2="36" stroke="#8296AD" strokeOpacity="0.3" strokeWidth="0.4" />
              <text x="169" y="37">NEURAL</text>
              <line x1="117" y1="130" x2="166" y2="124" stroke="#8296AD" strokeOpacity="0.3" strokeWidth="0.4" />
              <text x="169" y="125">CARDIAC</text>
              <line x1="116" y1="178" x2="166" y2="172" stroke="#8296AD" strokeOpacity="0.3" strokeWidth="0.4" />
              <text x="169" y="173">METAB</text>
              <line x1="43" y1="211" x2="24" y2="205" stroke="#8296AD" strokeOpacity="0.3" strokeWidth="0.4" />
              <text x="4" y="206">PPG</text>
            </g>
          </svg>

          {activeNode && (
            <div
              className="pointer-events-none absolute z-30 w-[208px] max-w-[76%] rounded-md border border-line bg-[#0A1320]/97 p-2.5 shadow-panel backdrop-blur"
              style={{
                left: `${(activeNode.x / 220) * 100}%`,
                top: `${(activeNode.y / 380) * 100}%`,
                transform: `translate(${activeNode.align === 'left' ? '-16%' : '-50%'}, -112%)`,
              }}
              role="tooltip"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-micro" style={{ color: activeNode.color }}>
                  {activeNode.label}
                </span>
                <span className="font-mono text-[7px] text-muted/60">SIM</span>
              </div>
              <div className="mt-1 font-mono text-[13px] leading-tight text-ink">{activeNode.value}</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-micro text-muted">{activeNode.source}</div>
              <p className="mt-1 text-[9px] leading-relaxed text-muted">{activeNode.note}</p>
              <div className="mt-1.5">
                <Badge tone={activeNode.tone} className="!text-[8px]">
                  {activeNode.status}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col divide-y divide-line-soft">
          <Indicator
            icon={<Zap size={12} className="text-violet" />}
            label="HRV status"
            value={`${snapshot.vitals.hrv} ms`}
            sub="RMSSD · baseline 56 ms"
            tone={status === 'normal' ? 'green' : status === 'suspected' ? 'amber' : 'red'}
            badge={status === 'normal' ? 'COHERENT' : 'DEVIATION'}
          />
          <Indicator
            icon={<HeartPulse size={12} className="text-cyan" />}
            label="Cardiological"
            value={`${snapshot.vitals.hr} BPM`}
            sub={`${cardiacNote} · PPG-derived`}
            tone={snapshot.vitals.hr > 84 ? 'amber' : 'green'}
            badge={snapshot.vitals.hr > 84 ? 'ELEVATED' : 'STABLE'}
          />
          <Indicator
            icon={<Brain size={12} className="text-violet" />}
            label="Neurological proxy"
            value={`${neuroScore} / 100`}
            sub="Sleep + activity proxy · not measured"
            tone="blue"
            badge="PROXY"
          />

          <div className="flex flex-1 flex-col justify-center px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="label-xs">Potential autonomic stress pattern</span>
              <span className={`font-mono text-[10px] uppercase tracking-micro ${riskTone}`}>{riskLabel}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base/80 ring-1 ring-inset ring-line">
              <div
                className={`h-full rounded-full ${riskBg} transition-all duration-700`}
                style={{ width: `${Math.max(6, risk)}%`, boxShadow: '0 0 12px rgba(255,83,100,0.35)' }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-muted">
              <span>INFERRED RISK</span>
              <span className="tabular-nums text-ink">{risk}/100</span>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-muted/90">
              Inferred from multi-channel signal deviations.{' '}
              <span className="text-ink/80">Not a directly measured biomarker.</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone="neutral" className="!text-[7.5px]">PPG</Badge>
              <Badge tone="neutral" className="!text-[7.5px]">R-R</Badge>
              <Badge tone="neutral" className="!text-[7.5px]">IMU</Badge>
              <Badge tone="neutral" className="!text-[7.5px]">TEMP</Badge>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Indicator({
  icon,
  label,
  value,
  sub,
  tone,
  badge,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  badge: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-base/60">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="label-xs">{label}</span>
          <Badge tone={tone} className="!text-[8px]">
            {badge}
          </Badge>
        </div>
        <div className="mt-1 font-mono text-[15px] leading-none text-ink">{value}</div>
        <div className="mt-1 truncate font-mono text-[9px] text-muted">{sub}</div>
      </div>
    </div>
  );
}
