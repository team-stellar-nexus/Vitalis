import type { DemoScenario, PhysiologicalBaseline, SensorId } from '@/lib/types';

/**
 * A crew member is a fully independent demo profile: its own mission, personal
 * baseline, simulation clock, signal history and anomaly state. The backend
 * equivalent is one record per astronaut with the same baseline fields.
 */
export interface AstronautProfile {
  profileId: string;
  id: string;
  name: string;
  callsign: string;
  rank: string;
  role: string;
  missionId: string;
  missionName: string;
  vehicle: string;
  orbit: string;
  groundStation: string;
  phase: string;
  baselineDays: number;
  baselineWindows: number;
  baselineComplete: boolean;
  baseline: PhysiologicalBaseline;
  demoScenario: DemoScenario;
  accent: 'cyan' | 'blue' | 'violet';
  summary: string;
}

export const CREW_PROFILES: AstronautProfile[] = [
  {
    profileId: 'maya-chen',
    id: 'AST-001',
    name: 'Maya Chen',
    callsign: 'A-01',
    rank: 'CDR',
    role: 'Mission Commander',
    missionId: 'SNX-001',
    missionName: 'ORPHEUS / LEO ANALOG HABITAT',
    vehicle: 'LEO Analog Habitat',
    orbit: 'LEO 408 km · 51.6°',
    groundStation: 'Ground relay · demo link',
    phase: 'Baseline monitoring · Phase II',
    baselineDays: 14,
    baselineWindows: 4820,
    baselineComplete: true,
    baseline: { hr: 64, hrv: 61, spo2: 98.2, temp: 36.62, activity: 62, sleep: 84 },
    demoScenario: 'normal',
    accent: 'cyan',
    summary: 'Stable baseline. No sustained multi-channel deviation in the current demo window.',
  },
  {
    profileId: 'elias-voss',
    id: 'AST-002',
    name: 'Elias Voss',
    callsign: 'A-02',
    rank: 'FLT',
    role: 'Flight Surgeon / Subject',
    missionId: 'SNX-002',
    missionName: 'ORPHEUS / AUTONOMIC SHIFT STUDY',
    vehicle: 'LEO Analog Habitat',
    orbit: 'LEO 408 km · 51.6°',
    groundStation: 'Ground relay · demo link',
    phase: 'Autonomic monitoring · Phase III',
    baselineDays: 21,
    baselineWindows: 6040,
    baselineComplete: true,
    baseline: { hr: 72, hrv: 47, spo2: 97.4, temp: 36.77, activity: 48, sleep: 66 },
    demoScenario: 'suspected',
    accent: 'violet',
    summary: 'Slow HRV deviation with no co-affected channel. Screened as a potential autonomic stress pattern.',
  },
  {
    profileId: 'noor-haddad',
    id: 'AST-003',
    name: 'Noor Haddad',
    callsign: 'A-03',
    rank: 'LT',
    role: 'Systems Officer',
    missionId: 'SNX-003',
    missionName: 'ORPHEUS / MULTI-CHANNEL VALIDATION',
    vehicle: 'LEO Analog Habitat',
    orbit: 'LEO 408 km · 51.6°',
    groundStation: 'Ground relay · demo link',
    phase: 'Fusion validation · Phase IV',
    baselineDays: 9,
    baselineWindows: 2180,
    baselineComplete: true,
    baseline: { hr: 81, hrv: 39, spo2: 96.6, temp: 36.91, activity: 38, sleep: 54 },
    demoScenario: 'confirmed',
    accent: 'blue',
    summary: 'Multi-window deviation with SpO₂ and thermal witness channels co-affected. Monitoring flag only.',
  },
];

export const DEFAULT_PROFILE = CREW_PROFILES[0];

export function getProfile(profileId: string): AstronautProfile {
  return CREW_PROFILES.find((profile) => profile.profileId === profileId) ?? DEFAULT_PROFILE;
}

export function profileInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export type RiskBand = 'Low' | 'Moderate' | 'High';

export function riskBand(status: 'normal' | 'suspected' | 'confirmed'): RiskBand {
  if (status === 'confirmed') return 'High';
  if (status === 'suspected') return 'Moderate';
  return 'Low';
}

export function riskTone(status: 'normal' | 'suspected' | 'confirmed'): 'green' | 'amber' | 'red' {
  if (status === 'confirmed') return 'red';
  if (status === 'suspected') return 'amber';
  return 'green';
}

export const SYSTEM_CHANNELS: Array<{
  id: 'cardiovascular' | 'oxygenation' | 'thermal' | 'recovery';
  label: string;
  channels: SensorId[];
  color: string;
}> = [
  { id: 'cardiovascular', label: 'Cardiovascular', channels: ['hr', 'hrv'], color: '#35D9F2' },
  { id: 'oxygenation', label: 'Oxygenation', channels: ['spo2'], color: '#438AFF' },
  { id: 'thermal', label: 'Thermal', channels: ['temp'], color: '#FFB84D' },
  { id: 'recovery', label: 'Recovery', channels: ['sleep', 'activity'], color: '#9675FF' },
];
