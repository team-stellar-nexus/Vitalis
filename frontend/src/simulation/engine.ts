import { SENSOR_ORDER, SENSORS } from '@/lib/sensors';
import type { AstronautProfile } from '@/lib/crew';
import type {
  Anomaly,
  AnomalyStatus,
  ChannelStatus,
  DemoScenario,
  FusionResult,
  MissionEvent,
  SensorId,
  SensorReading,
  StreamHealth,
  TelemetrySnapshot,
  TrendPoint,
  WindowDetection,
  WindowSeconds,
  WitnessChannel,
} from '@/lib/types';
import { clamp } from '@/lib/utils';
import {
  SCENARIOS,
  WINDOW_SECONDS,
  WINDOW_SENSITIVITY,
  WINDOW_THRESHOLDS,
  WITNESS_LEVELS,
} from '@/simulation/scenarios';
import { generateECG, generatePPG, generateRRIntervals } from '@/simulation/signal';

const MET_BASE_SECONDS = 18 * 86400 + 4 * 3600 + 22 * 60 + 14;
const HISTORY_SECONDS = 300;
const RISK_HISTORY = 160;
const EVENT_LIMIT = 48;

type Listener = (snapshot: TelemetrySnapshot) => void;

interface Vitals {
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  activity: number;
  sleep: number;
}

const round = (v: number, d = 1) => Number(v.toFixed(d));

/**
 * Local simulation engine.
 *
 * Emits a complete TelemetrySnapshot every tick: physiology, window
 * reconstruction errors, fusion + witness outcomes and the event log. The
 * public surface (`subscribe` / `getSnapshot`) mirrors what a WebSocket
 * telemetry adapter would expose, so the UI is agnostic about the source.
 */
export class SimulationEngine {
  private profile: AstronautProfile;
  private snapshotData: TelemetrySnapshot;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickMs = 1000;
  private speed = 1;
  private paused = false;
  private dropout = false;
  private scenario: DemoScenario;
  private simTime = 0;
  private intensity: number;
  private tickCount = 0;
  private history: TrendPoint[] = [];
  private riskHistory: Array<{ t: number; score: number; error: number; threshold: number }> = [];
  private windowHistory: Record<WindowSeconds, Array<{ t: number; error: number }>> = {
    30: [],
    60: [],
    120: [],
    240: [],
  };
  private events: MissionEvent[] = [];
  private anomalyLog: Anomaly[] = [];
  private anomalySeq = 118;
  private eventSeq = 0;
  private lastStatus: AnomalyStatus = 'normal';
  private lastFlagged = 0;
  private liveVitals: Vitals;

  constructor(profile: AstronautProfile, scenario: DemoScenario = profile.demoScenario, tickMs = 1000) {
    this.profile = profile;
    this.scenario = scenario;
    this.tickMs = tickMs;
    this.intensity = SCENARIOS[scenario].intensity;
    this.liveVitals = this.computeVitals(0, this.intensity, false);
    this.seedHistory();
    this.seedEvents();
    this.seedAnomalyLog();
    this.snapshotData = this.buildSnapshot();
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                       */
  /* ---------------------------------------------------------------- */

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): TelemetrySnapshot => this.snapshotData;

  start() {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this.stop();
    this.listeners.clear();
  }

  setRefreshMs(ms: number) {
    if (ms === this.tickMs) return;
    this.tickMs = ms;
    if (this.timer !== null) {
      this.stop();
      if (!this.paused) this.start();
    }
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setScenario(scenario: DemoScenario) {
    if (scenario === this.scenario) return;
    this.scenario = scenario;
    this.pushEvent({
      title: `Scenario switched · ${SCENARIOS[scenario].label}`,
      detail: SCENARIOS[scenario].expected,
      severity: scenario === 'confirmed' ? 'critical' : scenario === 'suspected' ? 'warning' : 'info',
      category: 'system',
    });
    this.emit();
  }

  setDropout(enabled: boolean) {
    if (enabled === this.dropout) return;
    this.dropout = enabled;
    this.pushEvent({
      title: enabled ? 'SpO₂ sensor dropout injected' : 'SpO₂ sensor link restored',
      detail: enabled
        ? 'Channel marked NO DATA. Witness validation degrades to remaining channels.'
        : 'Channel back online. Buffers re-synchronising.',
      severity: enabled ? 'warning' : 'success',
      category: 'sensor',
    });
    this.emit();
  }

  pause() {
    this.paused = true;
    this.stop();
    this.pushEvent({
      title: 'Telemetry paused',
      detail: 'Stream buffer frozen by operator. Inference clock held.',
      severity: 'info',
      category: 'system',
    });
    this.emit();
  }

  resume() {
    this.paused = false;
    this.pushEvent({
      title: 'Telemetry resumed',
      detail: 'Live buffer re-joined. Latency re-synchronising with simulation clock.',
      severity: 'success',
      category: 'system',
    });
    this.start();
    this.emit();
  }

  reset() {
    this.simTime = 0;
    this.tickCount = 0;
    this.intensity = SCENARIOS[this.scenario].intensity;
    this.lastStatus = 'normal';
    this.lastFlagged = 0;
    this.history = [];
    this.riskHistory = [];
    this.windowHistory = { 30: [], 60: [], 120: [], 240: [] };
    this.events = [];
    this.anomalyLog = [];
    this.liveVitals = this.computeVitals(0, this.intensity, false);
    this.seedHistory();
    this.seedEvents();
    this.seedAnomalyLog();
    this.pushEvent({
      title: 'Simulation buffer reset',
      detail: 'Rolling windows cleared and re-seeded from the baseline distribution.',
      severity: 'info',
      category: 'system',
    });
    this.snapshotData = this.buildSnapshot();
    this.emit();
  }

  /* ---------------------------------------------------------------- */
  /* Simulation                                                       */
  /* ---------------------------------------------------------------- */

  private computeVitals(offset: number, intensity: number, noisy: boolean): Vitals {
    const t = this.simTime + offset;
    const p = this.profile.baseline;
    const phase = this.profile.profileId.length * 0.37;
    const jitter = (scale: number) =>
      noisy
        ? (Math.random() - 0.5) * 2 * scale
        : scale * 0.7 * Math.sin(t * 7.13 + 0.4 + phase) * Math.sin(t * 2.31 + 1.7);
    return {
      hr: p.hr + 3.6 * Math.sin(t / 41 + phase) + intensity * 17 + jitter(1.1),
      hrv: p.hrv - intensity * 21 + 3.2 * Math.sin(t / 67 + 1.1 + phase) + jitter(0.9),
      spo2: p.spo2 - intensity * 2.1 + 0.28 * Math.sin(t / 53 + phase) + jitter(0.16),
      temp: p.temp + intensity * 0.33 + 0.035 * Math.sin(t / 88 + phase) + jitter(0.015),
      activity: clamp(p.activity + 14 * Math.sin(t / 97 + phase) + intensity * 6 + jitter(4), 12, 96),
      sleep: p.sleep - intensity * 9 + 0.6 * Math.sin(t / 210 + phase),
    };
  }

  private seedHistory() {
    for (let i = HISTORY_SECONDS; i > 0; i--) {
      const v = this.computeVitals(-i, this.intensity, false);
      const risk = clamp(
        ((0.58 + this.intensity * 0.98 + (Math.random() - 0.5) * 0.05 - 0.4) / 1.25) * 100,
        0,
        100,
      );
      this.history.push({
        t: this.simTime - i,
        hr: round(v.hr),
        hrv: round(v.hrv),
        spo2: round(v.spo2, 1),
        temp: round(v.temp, 2),
        activity: round(v.activity),
        risk: round(risk),
      });
      this.riskHistory.push({
        t: this.simTime - i,
        score: round(risk),
        error: round(0.58 * 0.0181, 4),
        threshold: 0.0181,
      });
    }
    for (const w of WINDOW_SECONDS) {
      this.windowHistory[w] = Array.from({ length: 40 }, (_, i) => ({
        t: this.simTime - (40 - i) * 3,
        error: round(
          0.58 * WINDOW_THRESHOLDS[w] * (1 + 0.05 * Math.sin(i / 3 + w)),
          4,
        ),
      }));
    }
  }

  private seedEvents() {
    const now = Date.now();
    const seeded: Array<Omit<MissionEvent, 'id'>> = [
      {
        timestamp: now - 2400,
        title: 'Telemetry link established',
        detail: 'Wearable PPG + HRV pack paired. 6 channels negotiated over local simulation transport.',
        severity: 'success',
        category: 'sensor',
      },
      {
        timestamp: now - 1680,
        title: 'Baseline autoencoder loaded',
        detail: 'CAE-4W · 14-day individual baseline · threshold rule mean + 2σ.',
        severity: 'info',
        category: 'system',
      },
      {
        timestamp: now - 720000,
        title: 'Witness channel validation passed',
        detail: 'Earlier event cleared: SpO₂ and skin temperature remained inside threshold band.',
        severity: 'success',
        category: 'witness',
      },
      {
        timestamp: now - 900000,
        title: 'Multi-window threshold crossed',
        detail: '3 of 4 windows above threshold. Event later resolved as suspected artifact.',
        severity: 'warning',
        category: 'fusion',
      },
      {
        timestamp: now - 960000,
        title: 'Sensor readings updated',
        detail: 'Rolling buffer refreshed · 25 Hz resample · band-pass 0.5–8 Hz.',
        severity: 'info',
        category: 'sensor',
      },
    ];
    seeded.forEach((e) =>
      this.events.push({
        ...e,
        id: this.nextEventId(),
        astronautId: this.profile.id,
        astronautName: this.profile.name,
      }),
    );
  }

  private seedAnomalyLog() {
    const now = Date.now();
    const score = this.riskScore();
    const status: AnomalyStatus =
      this.scenario === 'confirmed' ? 'confirmed' : this.scenario === 'suspected' ? 'suspected' : 'normal';
    const witnesses = this.supportingWitnesses();
    this.anomalyLog = [
      {
        id: 'ANM-0117',
        detectedAt: now - 720000,
        status,
        score,
        reconstructionError: 0.0294,
        threshold: 0.0181,
        windowsFlagged: this.flaggedWindows().length,
        windowCount: 4,
        witnesses,
        summary:
          status === 'normal'
            ? 'Historical event · resolved. All windows returned below the personal baseline threshold.'
            : 'Historical event · monitoring flag. Witness channels and intervals remain available for review.',
        simulated: true,
      },
      {
        id: 'ANM-0116',
        detectedAt: now - 1080000,
        status: status === 'confirmed' ? 'suspected' : status,
        score: Math.max(8, score - 18),
        reconstructionError: 0.0213,
        threshold: 0.0181,
        windowsFlagged: 2,
        windowCount: 4,
        witnesses: [],
        summary: 'Isolated HRV deviation without supporting channels — logged as a suspected artifact.',
        simulated: true,
      },
    ];
  }

  private tick() {
    const dt = (this.tickMs / 1000) * this.speed;
    this.tickCount += 1;
    this.simTime += dt;
    this.liveVitals = this.computeVitals(0, this.intensity, true);

    const target = SCENARIOS[this.scenario].intensity;
    this.intensity += (target - this.intensity) * 0.26;
    if (Math.abs(target - this.intensity) < 0.002) this.intensity = target;

    this.history.push({
      t: this.simTime,
      hr: round(this.liveVitals.hr),
      hrv: round(this.liveVitals.hrv),
      spo2: round(this.liveVitals.spo2, 1),
      temp: round(this.liveVitals.temp, 2),
      activity: round(this.liveVitals.activity),
      risk: 0,
    });
    if (this.history.length > HISTORY_SECONDS) this.history.shift();

    this.recordPeriodicEvents();
    this.snapshotData = this.buildSnapshot();
    this.emit();
  }

  private recordPeriodicEvents() {
    const status = this.anomalyStatus();
    if (this.tickCount % 12 === 0) {
      this.pushEvent({
        title: 'Sensor readings updated',
        detail: `${(25).toFixed(0)} Hz resample · 0.5–8 Hz band-pass · ${this.intensity > 0.4 ? 'elevated' : 'stable'} signal variance.`,
        severity: 'info',
        category: 'sensor',
        channel: 'multi',
        status: 'monitoring',
      });
    }
    if (this.tickCount % 18 === 0 && this.intensity > 0.1) {
      const supporting = this.supportingWitnesses();
      this.pushEvent({
        title: supporting.length > 0 ? 'Witness-channel validation passed' : 'Witness-channel validation checked',
        detail:
          supporting.length > 0
            ? `${supporting.length} supporting channel${supporting.length > 1 ? 's' : ''} above threshold: ${supporting.join(', ').toUpperCase()}.`
            : 'No supporting channel above threshold. Anomaly remains suspected artifact.',
        severity: supporting.length > 0 ? 'warning' : 'info',
        category: 'witness',
        channel: 'hrv',
        status: supporting.length > 0 ? 'validated' : 'open',
      });
    }
    if (this.tickCount % 40 === 0) {
      this.pushEvent({
        title: 'System health nominal',
        detail: 'CAE inference loop under latency budget · no packet loss above 0.5%.',
        severity: 'success',
        category: 'system',
        channel: 'multi',
        status: 'resolved',
      });
    }
    if (this.tickCount % 60 === 0) {
      this.pushEvent({
        title: 'Recovery indicators updated',
        detail: `Sleep/recovery ${Math.round(this.liveVitals.sleep)}/100 · activity ${Math.round(this.liveVitals.activity)} idx against personal baseline. Aggregate only; no treatment inference.`,
        severity: 'info',
        category: 'signal',
        channel: this.liveVitals.sleep < this.profile.baseline.sleep - 8 ? 'sleep' : 'activity',
        status: 'monitoring',
      });
    }

    const flagged = this.flaggedWindows().length;
    if (flagged >= 2 && this.lastFlagged < 2) {
      this.pushEvent({
        title: 'Multi-window threshold crossed',
        detail: `${flagged} of 4 windows above mean + 2σ. Fusion rule satisfied.`,
        severity: 'warning',
        category: 'fusion',
        channel: 'multi',
        status: 'monitoring',
      });
    }
    if (status !== this.lastStatus) {
      if (status === 'confirmed') {
        const witnesses = this.supportingWitnesses();
        this.pushEvent({
          title: 'New anomaly detected · confirmed',
          detail: `Fusion + witness rules met (${witnesses.join(', ').toUpperCase() || 'n/a'}). Potential autonomic stress pattern; this is a monitoring flag, not a diagnosis.`,
          severity: 'critical',
          category: 'alert',
          channel: 'hrv',
          status: 'open',
        });
        const score = this.riskScore();
        this.anomalyLog.unshift({
          id: this.nextAnomalyId(),
          detectedAt: Date.now(),
          status: 'confirmed',
          score,
          reconstructionError: this.meanError(),
          threshold: this.meanThreshold(),
          windowsFlagged: flagged,
          windowCount: 4,
          witnesses,
          summary: 'Multi-window fusion crossed with ≥1 supporting witness channel.',
          simulated: true,
        });
        if (this.anomalyLog.length > 14) this.anomalyLog.pop();
        this.pushEvent({
          title: 'Monitoring recommendation issued',
          detail:
            'Maintain 120 s and 240 s fusion windows, verify SpO₂ and thermal witnesses, and escalate to the flight surgeon if the pattern persists beyond the next review interval.',
          severity: 'info',
          category: 'signal',
          channel: 'multi',
          status: 'monitoring',
        });
      } else if (status === 'suspected') {
        this.pushEvent({
          title: 'Baseline deviation detected · suspected',
          detail: 'HRV deviation above threshold without supporting witness channel. Pending review.',
          severity: 'warning',
          category: 'alert',
          channel: 'hrv',
          status: 'open',
        });
        this.anomalyLog.unshift({
          id: this.nextAnomalyId(),
          detectedAt: Date.now(),
          status: 'suspected',
          score: this.riskScore(),
          reconstructionError: this.meanError(),
          threshold: this.meanThreshold(),
          windowsFlagged: flagged,
          windowCount: 4,
          witnesses: [],
          summary: 'Single-channel deviation. Witness validation found no co-affected channel.',
          simulated: true,
        });
        if (this.anomalyLog.length > 14) this.anomalyLog.pop();
        this.pushEvent({
          title: 'Monitoring recommendation issued',
          detail:
            'Continue multi-window observation and check the next recovery aggregate. Do not infer a diagnosis from a single-channel deviation.',
          severity: 'info',
          category: 'signal',
          channel: 'hrv',
          status: 'monitoring',
        });
      } else if (this.lastStatus !== 'normal') {
        this.pushEvent({
          title: 'Signal returned to baseline',
          detail: 'Reconstruction error returned below threshold on all four windows.',
          severity: 'success',
          category: 'alert',
          channel: 'multi',
          status: 'resolved',
        });
      }
      this.lastStatus = status;
    }
    this.lastFlagged = flagged;
  }

  private flaggedWindows(): WindowSeconds[] {
    return WINDOW_SECONDS.filter((w) => this.windowRatio(w) > 1);
  }

  private supportingWitnesses(): SensorId[] {
    if (this.intensity <= 0.1) return [];
    const ids: SensorId[] = [];
    if (this.intensity > WITNESS_LEVELS.hrv) ids.push('hrv');
    if (this.intensity > WITNESS_LEVELS.spo2 && !this.dropout) ids.push('spo2');
    if (this.intensity > WITNESS_LEVELS.temp) ids.push('temp');
    if (this.intensity > WITNESS_LEVELS.activity) ids.push('activity');
    return ids.filter((id) => id !== 'hrv');
  }

  private anomalyStatus(): AnomalyStatus {
    const flagged = this.flaggedWindows().length;
    const supporting = this.supportingWitnesses();
    if (flagged >= 2 && supporting.length >= 1) return 'confirmed';
    if (flagged >= 2) return 'suspected';
    return 'normal';
  }

  private windowRatio(w: WindowSeconds) {
    return 0.58 + this.intensity * WINDOW_SENSITIVITY[w] + (Math.random() - 0.5) * 0.06;
  }

  private riskScore(): number {
    const ratios = WINDOW_SECONDS.map((w) => 0.58 + this.intensity * WINDOW_SENSITIVITY[w]);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return Math.round(clamp(((avg - 0.4) / 1.25) * 100, 0, 100));
  }

  private meanThreshold(): number {
    return round(
      WINDOW_SECONDS.reduce((a, w) => a + WINDOW_THRESHOLDS[w], 0) / WINDOW_SECONDS.length,
      4,
    );
  }

  private meanError(): number {
    return round(
      WINDOW_SECONDS.reduce((a, w) => a + this.windowRatio(w) * WINDOW_THRESHOLDS[w], 0) /
        WINDOW_SECONDS.length,
      4,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Snapshot assembly                                                */
  /* ---------------------------------------------------------------- */

  private buildSnapshot(): TelemetrySnapshot {
    const v = this.liveVitals;
    const windows: WindowDetection[] = WINDOW_SECONDS.map((w) => {
      const ratio = this.windowRatio(w);
      const error = round(ratio * WINDOW_THRESHOLDS[w], 4);
      const entry = { t: this.simTime, error };
      const hist = [...this.windowHistory[w], entry].slice(-40);
      this.windowHistory[w] = hist;
      return {
        windowSeconds: w,
        reconstructionError: error,
        threshold: WINDOW_THRESHOLDS[w],
        ratio: round(ratio, 2),
        flagged: ratio > 1,
        normalizedScore: Math.round(clamp(ratio * 55, 0, 100)),
        model: `CAE-${w}s`,
        updatedAt: Date.now(),
        history: hist,
      };
    });

    const flaggedWindows = windows.filter((w) => w.flagged).map((w) => w.windowSeconds);
    const status = this.anomalyStatus();
    const supporting = this.supportingWitnesses();
    const score = this.riskScore();
    const meanErr = this.meanError();
    const meanThr = this.meanThreshold();

    const witnesses: WitnessChannel[] = [
      this.makeWitness('hrv', 'Primary channel · R-R derived', status !== 'normal' ? 'anomaly' : 'normal'),
      this.makeWitness('spo2', this.dropout ? 'No data · sensor dropout' : 'Second PPG wavelength', this.dropout ? 'nodata' : 'normal'),
      this.makeWitness('temp', 'Skin thermistor', 'normal'),
      this.makeWitness('activity', 'IMU acceleration index', 'normal'),
      this.makeWitness('sleep', 'Daily aggregate · no continuous stream', 'nodata'),
    ];

    const fusion: FusionResult = {
      flaggedWindows,
      flaggedCount: flaggedWindows.length,
      requiredCount: 2,
      rule: '≥2 of 4 windows above mean + 2σ',
      alert: flaggedWindows.length >= 2,
      status,
      witnesses: supporting,
    };

    const riskEntry = {
      t: this.simTime,
      score,
      error: meanErr,
      threshold: meanThr,
    };
    this.riskHistory = [...this.riskHistory, riskEntry].slice(-RISK_HISTORY);
    this.history[this.history.length - 1].risk = score;

    const current: Anomaly | null =
      status === 'normal'
        ? null
        : {
            id: this.anomalyLog[0]?.id ?? this.nextAnomalyId(),
            detectedAt: Date.now(),
            status,
            score,
            reconstructionError: meanErr,
            threshold: meanThr,
            windowsFlagged: flaggedWindows.length,
            windowCount: 4,
            witnesses: supporting,
            summary:
              status === 'confirmed'
                ? 'Multi-window fusion satisfied with co-affected witness channels.'
                : 'Window fusion satisfied without supporting channel. Treat as suspected artifact.',
            simulated: true,
          };

    const sensors = this.buildSensors(witnesses);
    const activityLabel = this.activityLabel(v.activity);

    const health: StreamHealth = {
      sampleRateHz: 25,
      latencyMs: Math.round(46 + this.intensity * 24 + Math.random() * 6),
      packetLossPct: round(0.03 + this.intensity * 0.14 + Math.random() * 0.04, 2),
      bufferPct: Math.round(68 + Math.random() * 9),
      channelsOnline: this.dropout ? 5 : 6,
      channelsTotal: 6,
      batteryPct: 87,
      link: this.dropout ? 'degraded' : 'nominal',
    };

    return {
      mode: 'demo',
      scenario: this.scenario,
      simTime: this.simTime,
      metSeconds: MET_BASE_SECONDS + Math.floor(this.simTime) + this.profile.baselineDays * 3600,
      lastUpdate: Date.now(),
      paused: this.paused,
      astronaut: {
        id: this.profile.id,
        profileId: this.profile.profileId,
        name: this.profile.name,
        callsign: this.profile.callsign,
        rank: this.profile.rank,
        role: this.profile.role,
        missionId: this.profile.missionId,
        baselineWindows: this.profile.baselineWindows,
        baselineDays: this.profile.baselineDays,
        baselineComplete: this.profile.baselineComplete,
        baseline: { ...this.profile.baseline },
        simulated: true,
      },
      mission: {
        id: this.profile.missionId,
        name: this.profile.missionName,
        vehicle: this.profile.vehicle,
        phase: this.profile.phase,
        status: 'active',
        simulation: true,
        startedAt: '2026-10-19T04:22:14Z',
        metSeconds: MET_BASE_SECONDS + this.profile.baselineDays * 3600,
        orbit: this.profile.orbit,
        groundStation: this.profile.groundStation,
      },
      sensors,
      vitals: {
        hr: round(v.hr),
        hrv: round(v.hrv),
        spo2: round(v.spo2, 1),
        temp: round(v.temp, 2),
        activity: round(v.activity),
        sleep: round(v.sleep),
        activityLabel,
      },
      history: [...this.history],
      signal: {
        ppg: generatePPG({
          nowSec: this.simTime,
          durationSec: 10,
          sampleRateHz: 50,
          hr: v.hr,
          stress: this.intensity,
        }),
        ecg: generateECG({
          nowSec: this.simTime,
          durationSec: 6,
          sampleRateHz: 50,
          hr: v.hr,
          stress: this.intensity,
        }),
        rrIntervals: generateRRIntervals({
          hr: v.hr,
          hrv: v.hrv,
          stress: this.intensity,
        }),
        hrvTrend: this.history
          .filter((_, i) => i % 4 === 0)
          .slice(-45)
          .map((p) => ({ t: p.t, v: p.hrv })),
        spo2Trend: this.history
          .filter((_, i) => i % 4 === 0)
          .slice(-45)
          .map((p) => ({ t: p.t, v: p.spo2 })),
      },
      windows,
      anomaly: {
        score,
        status,
        reconstructionError: meanErr,
        threshold: meanThr,
        flaggedWindows: flaggedWindows.length,
        history: this.riskHistory,
        current,
        log: [...this.anomalyLog],
      },
      fusion,
      witnesses,
      events: [...this.events],
      model: {
        name: 'CAE-4W',
        architecture: 'Convolutional autoencoder · 4 window heads',
        baselineWindows: this.profile.baselineWindows,
        thresholdRule: 'mean + 2σ per window',
        windowSet: [30, 60, 120, 240],
        version: 'demo-0.9.4',
        inferenceMs: Math.round(38 + this.intensity * 14),
        simulated: true,
      },
      health,
    };
  }

  private makeWitness(id: SensorId, note: string, status: ChannelStatus): WitnessChannel {
    const meta = SENSORS[id];
    const threshold = 1;
    const supporting = status === 'anomaly';
    const base = 0.52 + this.intensity * (supporting ? 1.05 : 0.18);
    const score = id === 'hrv' ? Number((0.6 + this.intensity * 1.2).toFixed(2)) : Number(base.toFixed(2));
    const corr =
      id === 'hrv' ? 1 : id === 'spo2' ? 0.82 : id === 'temp' ? 0.74 : id === 'activity' ? 0.42 : 0.31;
    return {
      id,
      label: meta.label,
      status,
      score,
      threshold,
      supporting,
      similarity: Number(clamp(0.26 + this.intensity * 0.55 * corr, 0.12, 0.96).toFixed(2)),
      note,
    };
  }

  private buildSensors(witnesses: WitnessChannel[]): SensorReading[] {
    const v = this.liveVitals;
    const statusFor = (id: SensorId): ChannelStatus => {
      if (id === 'hr' || id === 'sleep') return 'normal';
      return witnesses.find((w) => w.id === id)?.status ?? 'normal';
    };
    return SENSOR_ORDER.map((id) => {
      const meta = SENSORS[id];
      const value = v[id];
      const digits = meta.decimals;
      const trend = this.history.slice(-26).map((p) => (id === 'sleep' ? v.sleep : p[id]));
      const quality =
        id === 'sleep' ? 84 : this.dropout && id === 'spo2' ? 0 : Math.round(99 - this.intensity * 6);
      return {
        id,
        label: meta.label,
        shortLabel: meta.short,
        unit: meta.unit,
        value: round(value, digits),
        displayValue:
          id === 'activity'
            ? this.activityLabel(value)
            : id === 'sleep'
              ? `${Math.round(value)}`
              : round(value, digits).toFixed(digits),
        precision: digits,
        status: statusFor(id),
        quality,
        updatedAt: this.snapshotData?.lastUpdate ?? Date.now(),
        trend,
        normalRange: meta.normalRange,
        source: meta.source,
      };
    });
  }

  private activityLabel(value: number) {
    if (value > 78) return 'Vigorous';
    if (value > 52) return 'Moderate';
    if (value > 28) return 'Light';
    return 'Sedentary';
  }

  private pushEvent(event: Omit<MissionEvent, 'id' | 'timestamp'>) {
    this.events.unshift({
      ...event,
      id: this.nextEventId(),
      timestamp: Date.now(),
      astronautId: this.profile.id,
      astronautName: this.profile.name,
    });
    if (this.events.length > EVENT_LIMIT) this.events.pop();
  }

  private nextEventId() {
    this.eventSeq += 1;
    return `EVT-${this.eventSeq.toString().padStart(4, '0')}`;
  }

  private nextAnomalyId() {
    this.anomalySeq += 1;
    return `ANM-${this.anomalySeq.toString().padStart(4, '0')}`;
  }

  private emit() {
    const snapshot = this.snapshotData;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
