import type { SensorId } from '@/lib/types';

export interface SensorMeta {
  id: SensorId;
  label: string;
  short: string;
  unit: string;
  color: string;
  decimals: number;
  normalRange: [number, number];
  source: string;
}

/** Sensor metadata is the single source of truth for labels, colours and units. */
export const SENSORS: Record<SensorId, SensorMeta> = {
  hr: {
    id: 'hr',
    label: 'Heart Rate',
    short: 'HR',
    unit: 'BPM',
    color: '#35D9F2',
    decimals: 0,
    normalRange: [58, 92],
    source: 'PPG · optical wrist',
  },
  hrv: {
    id: 'hrv',
    label: 'Heart Rate Variability',
    short: 'HRV',
    unit: 'ms',
    color: '#9675FF',
    decimals: 0,
    normalRange: [42, 72],
    source: 'PPG · R-R derived',
  },
  spo2: {
    id: 'spo2',
    label: 'Blood Oxygen',
    short: 'SpO₂',
    unit: '%',
    color: '#438AFF',
    decimals: 1,
    normalRange: [95, 100],
    source: 'PPG · dual wavelength',
  },
  temp: {
    id: 'temp',
    label: 'Skin Temperature',
    short: 'TEMP',
    unit: '°C',
    color: '#FFB84D',
    decimals: 2,
    normalRange: [35.8, 37.2],
    source: 'Thermistor · sternum',
  },
  activity: {
    id: 'activity',
    label: 'Physical Activity',
    short: 'ACT',
    unit: 'idx',
    color: '#35D49A',
    decimals: 0,
    normalRange: [20, 100],
    source: 'IMU · 3-axis',
  },
  sleep: {
    id: 'sleep',
    label: 'Sleep / Recovery',
    short: 'REC',
    unit: '/100',
    color: '#8FB3FF',
    decimals: 0,
    normalRange: [60, 100],
    source: 'Daily aggregate',
  },
};

export const SENSOR_ORDER: SensorId[] = ['hr', 'hrv', 'spo2', 'temp', 'activity', 'sleep'];
