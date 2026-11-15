import type { SignalPoint } from '@/lib/types';

/**
 * Deterministic synthetic physiology.
 *
 * These generators exist only to make the demo legible; they are not a
 * physiological model. The PPG shape is a two-peak (systolic + dicrotic)
 * approximation and the ECG is a P-QRS-T approximation so charts look like
 * real telemetry at a glance.
 */

export interface WaveOptions {
  /** Simulation time in seconds, used as the right edge of the window. */
  nowSec: number;
  durationSec: number;
  sampleRateHz: number;
  hr: number;
  /** 0–1 stress/artifact level used to distort the waveform. */
  stress?: number;
  beatsPerMinuteJitter?: number;
}

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

export function generatePPG({
  nowSec,
  durationSec,
  sampleRateHz,
  hr,
  stress = 0,
}: WaveOptions): SignalPoint[] {
  const points: SignalPoint[] = [];
  const period = 60 / hr;
  const start = nowSec - durationSec;
  const total = Math.round(durationSec * sampleRateHz);
  const firstBeat = Math.floor(start / period) - 1;

  for (let i = 0; i < total; i++) {
    const abs = start + i / sampleRateHz;
    let v = 0;
    for (let b = firstBeat; b < firstBeat + Math.ceil(durationSec / period) + 2; b++) {
      const beat = b * period;
      const dt = abs - beat;
      if (dt < -0.4 || dt > 0.75) continue;
      const amp = 1 + 0.07 * Math.sin(b * 2.1) + stress * 0.1 * Math.sin(b * 1.3);
      v +=
        amp * gauss(dt, 0.06, 0.08) +
        0.4 * amp * gauss(dt, 0.33, 0.115) -
        0.1 * amp * gauss(dt, 0.47, 0.07);
    }
    // Respiration baseline + suppressed 0.5 Hz band edge + optical noise.
    v +=
      0.075 * Math.sin(2 * Math.PI * 0.235 * abs) +
      0.018 * Math.sin(2 * Math.PI * 0.62 * abs) +
      (0.014 + stress * 0.02) * Math.sin(abs * 137.7) * Math.sin(abs * 61.3);

    points.push({ t: Number((abs - nowSec).toFixed(3)), v: Number(v.toFixed(4)) });
  }
  return points;
}

export function generateECG({
  nowSec,
  durationSec,
  sampleRateHz,
  hr,
  stress = 0,
}: WaveOptions): SignalPoint[] {
  const points: SignalPoint[] = [];
  const period = 60 / hr;
  const start = nowSec - durationSec;
  const total = Math.round(durationSec * sampleRateHz);
  const firstBeat = Math.floor(start / period) - 1;

  for (let i = 0; i < total; i++) {
    const abs = start + i / sampleRateHz;
    let v = 0;
    for (let b = firstBeat; b < firstBeat + Math.ceil(durationSec / period) + 2; b++) {
      const beat = b * period;
      const dt = abs - beat;
      if (dt < -0.42 || dt > 0.5) continue;
      v +=
        0.16 * gauss(dt, -0.19, 0.035) -
        0.1 * gauss(dt, -0.028, 0.012) +
        1.15 * gauss(dt, 0, 0.013) -
        0.22 * gauss(dt, 0.032, 0.016) +
        0.3 * gauss(dt, 0.235, 0.065);
    }
    v +=
      (0.008 + stress * 0.008) * Math.sin(abs * 91.3) +
      0.004 * Math.sin(abs * 211.7) +
      stress * 0.02 * Math.sin(abs * 37.1);
    points.push({ t: Number((abs - nowSec).toFixed(3)), v: Number(v.toFixed(4)) });
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* Beat-to-beat variability                                            */
/* ------------------------------------------------------------------ */

/**
 * Synthetic R-R tachogram. Respiratory sinus arrhythmia plus slower LF drift
 * and a little beat noise; the scatter tracks the simulated RMSSD so the HRV
 * card shows beat-to-beat variability rather than a rescaled waveform.
 */
export function generateRRIntervals({
  hr,
  hrv,
  beatCount = 48,
  stress = 0,
}: {
  hr: number;
  hrv: number;
  beatCount?: number;
  stress?: number;
}): number[] {
  const mean = 60000 / hr;
  const spread = Math.max(4, hrv * 0.85);
  const raw = Array.from({ length: beatCount }, (_, i) => {
    const rsa = Math.sin(i * 0.55 + 0.4) * spread * 0.55;
    const lfDrift = Math.sin(i * 0.21 + 1.7) * spread * 0.34;
    const beatNoise = Math.sin(i * 2.73 + 0.9) * spread * 0.18;
    const stressShift = stress * 7 * Math.sin(i * 1.31 + 0.2);
    return rsa + lfDrift + beatNoise + stressShift;
  });
  const rawMean = raw.reduce((a, b) => a + b, 0) / raw.length;
  let diffSquares = 0;
  for (let i = 1; i < raw.length; i += 1) {
    diffSquares += (raw[i] - raw[i - 1]) ** 2;
  }
  const rawRmssd = Math.sqrt(diffSquares / Math.max(1, raw.length - 1)) || 1;
  // Scale the shape so the tachogram's RMSSD equals the reported HRV value.
  const target = Math.max(4, hrv);
  return raw.map((value) => Math.round(mean + ((value - rawMean) / rawRmssd) * target));
}

/* ------------------------------------------------------------------ */
/* Time-frequency representation                                       */
/* ------------------------------------------------------------------ */

export interface SpectrogramStats {
  peakFreq: number;
  peakPower: number;
  bandEnergy: number;
  entropy: number;
  snr: number;
}

export interface SpectrogramData {
  z: number[][];
  freqs: number[];
  times: number[];
  stats: SpectrogramStats;
  rangeSeconds: number;
  frequencyRange: [number, number];
}

export interface SpectrogramOptions {
  rangeSeconds: number;
  intensity: number;
  hr: number;
  seed?: number;
  frequencyRange?: [number, number];
  timeBins?: number;
  freqBins?: number;
}

/**
 * A simulated STFT magnitude matrix. Ridges follow the cardiac fundamental
 * (HR/60), its harmonics, and a low-frequency respiration band; broadband
 * bursts are injected when the scenario intensity rises, mirroring the
 * LIGO Omega-scan style time-frequency plot described in the project plan.
 */
export function buildSpectrogram({
  rangeSeconds,
  intensity,
  hr,
  seed = 1,
  frequencyRange = [0.5, 8],
  timeBins = 104,
  freqBins = 40,
}: SpectrogramOptions): SpectrogramData {
  const [fMin, fMax] = frequencyRange;
  const freqs = Array.from({ length: freqBins }, (_, i) => fMin + (i / (freqBins - 1)) * (fMax - fMin));
  const times = Array.from(
    { length: timeBins },
    (_, i) => -rangeSeconds + (i / (timeBins - 1)) * rangeSeconds,
  );

  const ridge = (f: number, centre: number, width: number) => gauss(f, centre, width);
  const raw: number[][] = [];

  for (let fi = 0; fi < freqBins; fi++) {
    const f = freqs[fi];
    const row: number[] = [];
    for (let ti = 0; ti < timeBins; ti++) {
      const t = times[ti];
      const u = (t + rangeSeconds) / rangeSeconds;
      const drift = 1 + 0.018 * Math.sin(t / 7.5 + seed);
      const f0 = (hr / 60) * drift;

      let v = 0.045 + 0.26 * Math.exp(-(f - fMin) * 0.85);
      v += (0.62 + 0.08 * Math.sin(t / 4.2)) * ridge(f, f0, 0.05 + intensity * 0.035);
      v += 0.3 * ridge(f, f0 * 2, 0.085);
      v += (0.14 + 0.06 * Math.sin(t / 6.1)) * ridge(f, f0 * 3, 0.11);
      v += 0.2 * ridge(f, 0.23, 0.05);
      v += 0.018 * Math.sin(f * 31.7 + t * 2.3 + seed) * Math.sin(t * 1.7 + f * 4);

      const centers = [0.53, 0.72, 0.88];
      for (let c = 0; c < centers.length; c++) {
        const center = centers[c];
        const width = 0.012 + intensity * 0.02;
        const bandCentre = 2.3 + c * 0.85;
        v +=
          intensity *
          0.85 *
          Math.exp(-(((u - center) / width) ** 2)) *
          gauss(f, bandCentre, 1.15);
        v += intensity * 0.22 * Math.exp(-(((u - center) / 0.006) ** 2)) * Math.exp(-f * 0.22);
      }
      row.push(v);
    }
    raw.push(row);
  }

  const max = Math.max(...raw.flat());
  const z = raw.map((row) => row.map((v) => Number(Math.pow(v / max, 0.9).toFixed(4))));

  // Statistics derived from the time-averaged spectrum.
  const mean = freqs.map((_, fi) => z[fi].reduce((a, b) => a + b, 0) / timeBins);
  let peakIdx = 0;
  mean.forEach((v, i) => {
    if (v > mean[peakIdx]) peakIdx = i;
  });
  const total = mean.reduce((a, b) => a + b, 0) || 1;
  const probs = mean.map((v) => v / total);
  const entropy = -probs.reduce((a, p) => (p > 0 ? a + p * Math.log2(p) : a), 0) / Math.log2(freqBins);
  const sorted = [...mean].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0.001;

  return {
    z,
    freqs,
    times,
    rangeSeconds,
    frequencyRange: [fMin, fMax],
    stats: {
      peakFreq: Number(freqs[peakIdx].toFixed(2)),
      peakPower: Number(mean[peakIdx].toFixed(3)),
      bandEnergy: Number(mean.reduce((a, b) => a + b, 0).toFixed(2)),
      entropy: Number(entropy.toFixed(3)),
      snr: Number((mean[peakIdx] / median).toFixed(1)),
    },
  };
}

export const SPECTROGRAM_COLORSCALE: Array<[number, string]> = [
  [0, '#070B14'],
  [0.12, '#081426'],
  [0.28, '#0E2A44'],
  [0.44, '#134C72'],
  [0.58, '#186F9E'],
  [0.7, '#2E7FE0'],
  [0.8, '#5A6BFF'],
  [0.88, '#9675FF'],
  [0.94, '#35D9F2'],
  [1, '#FFD166'],
];
