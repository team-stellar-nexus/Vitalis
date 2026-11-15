import type { SignalData } from '@/lib/types';
import type { NexusApi, SignalHistoryQuery } from '@/services/contracts';
import { SimulationEngine } from '@/simulation/engine';

/**
 * Default adapter: serves the integration methods from the local simulation
 * engine. Every reading it returns is synthetic, and every payload is labelled
 * `simulated` / mode `demo` where the contract carries that flag.
 */
export class MockNexusApi implements NexusApi {
  readonly mode = 'demo' as const;

  constructor(private engine: SimulationEngine) {}

  async getMissionOverview() {
    const s = this.engine.getSnapshot();
    return {
      astronaut: s.astronaut,
      mission: s.mission,
      sensors: s.sensors,
      anomaly:
        s.anomaly.current ??
        ({
          id: 'ANM-NONE',
          detectedAt: Date.now(),
          status: 'normal',
          score: s.anomaly.score,
          reconstructionError: s.anomaly.reconstructionError,
          threshold: s.anomaly.threshold,
          windowsFlagged: 0,
          windowCount: 4,
          witnesses: [],
          summary: 'No active anomaly. All windows below threshold.',
          simulated: true,
        } as const),
      health: s.health,
    };
  }

  async getLatestSensors() {
    return this.engine.getSnapshot().sensors;
  }

  async getSignalHistory(query: SignalHistoryQuery): Promise<SignalData> {
    const s = this.engine.getSnapshot();
    const key =
      query.channel === 'hrv' ? 'hrv' : query.channel === 'spo2' ? 'spo2' : query.channel === 'hr' ? 'hr' : 'hr';
    const points = s.signal[key === 'hrv' ? 'hrvTrend' : key === 'spo2' ? 'spo2Trend' : 'ppg'].map((p) => ({
      t: p.t,
      v: p.v,
    }));
    return {
      channel: query.channel,
      label: s.sensors.find((x) => x.id === query.channel)?.label ?? query.channel,
      unit: s.sensors.find((x) => x.id === query.channel)?.unit ?? '',
      sampleRateHz: key === 'hrv' || key === 'spo2' ? 0.25 : 50,
      windowSeconds: query.windowSeconds,
      filtered: query.filtered ?? true,
      points: points.slice(-(query.limit ?? 600)),
    };
  }

  async getAnomalies() {
    return this.engine.getSnapshot().anomaly.log;
  }

  async getWitnessChannels() {
    return this.engine.getSnapshot().witnesses;
  }

  connectTelemetry(handlers: Parameters<NexusApi['connectTelemetry']>[0]) {
    handlers.onStatus?.('open', 'Local simulation transport');
    const unsubscribe = this.engine.subscribe((snapshot) => {
      handlers.onSnapshot?.(snapshot);
    });
    return unsubscribe;
  }
}
