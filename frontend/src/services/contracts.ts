import type {
  Anomaly,
  DataMode,
  MissionOverviewPayload,
  SensorId,
  SensorReading,
  SignalData,
  WitnessChannel,
} from '@/lib/types';

/**
 * Proposed frontend integration contract.
 *
 * These endpoints do NOT exist yet — they are the hand-off surface agreed with
 * the signal-processing / autoencoder team. The dashboard runs on the local
 * simulation adapter by default and will use these paths once a live backend is
 * supplied via VITE_NEXUS_API_URL.
 */
export const API_ENDPOINTS = {
  astronauts: '/api/astronauts',
  missionOverview: '/api/mission/overview',
  sensorsLatest: '/api/sensors/latest',
  signalsHistory: '/api/signals/history',
  anomalies: '/api/anomalies',
  witnessChannels: '/api/witness-channels',
  telemetrySocket: '/ws/telemetry',
} as const;

export interface ApiConfig {
  mode: DataMode;
  baseUrl: string;
  socketUrl: string;
}

export interface SignalHistoryQuery {
  /** Optional crew member selector; the active local profile is the default. */
  astronautId?: string;
  channel: SensorId;
  windowSeconds: 30 | 60 | 120 | 240;
  limit?: number;
  filtered?: boolean;
}

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

export interface TelemetrySocketHandlers {
  onSnapshot?: (payload: unknown) => void;
  onAnomaly?: (payload: Anomaly) => void;
  onEvent?: (payload: unknown) => void;
  onStatus?: (state: ConnectionState, detail?: string) => void;
}

export interface NexusApi {
  readonly mode: DataMode;
  getMissionOverview(astronautId?: string): Promise<MissionOverviewPayload>;
  getLatestSensors(astronautId?: string): Promise<SensorReading[]>;
  getSignalHistory(query: SignalHistoryQuery): Promise<SignalData>;
  getAnomalies(astronautId?: string): Promise<Anomaly[]>;
  getWitnessChannels(astronautId?: string): Promise<WitnessChannel[]>;
  /** Returns an unsubscribe function. */
  connectTelemetry(handlers: TelemetrySocketHandlers): () => void;
}

export class NexusApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NexusApiError';
    this.status = status;
  }
}

const resolveConfig = (): ApiConfig => {
  const base = (import.meta.env.VITE_NEXUS_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const socketEnv = import.meta.env.VITE_NEXUS_WS_URL as string | undefined;
  const derivedSocket = base ? base.replace(/^http/, 'ws') : '';
  return {
    mode: 'live',
    baseUrl: base,
    socketUrl: socketEnv ?? derivedSocket,
  };
};

/** Real transport placeholder — used only when the operator selects LIVE. */
export class HttpNexusApi implements NexusApi {
  readonly mode: DataMode = 'live';
  private config: ApiConfig;

  constructor(config: ApiConfig = resolveConfig()) {
    this.config = config;
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.config.baseUrl) {
      throw new NexusApiError(
        'No live telemetry endpoint configured. Set VITE_NEXUS_API_URL to the signal-processing service base URL.',
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new NexusApiError(`Telemetry service responded ${res.status} for ${path}`, res.status);
      }
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof NexusApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NexusApiError(`Request to ${path} timed out after 6s.`);
      }
      throw new NexusApiError(
        `Unable to reach ${this.config.baseUrl || 'the telemetry service'}. ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  getMissionOverview(astronautId?: string) {
    const query = astronautId ? `?astronaut_id=${encodeURIComponent(astronautId)}` : '';
    return this.request<MissionOverviewPayload>(`${API_ENDPOINTS.missionOverview}${query}`);
  }

  private scoped(path: string, astronautId?: string) {
    return astronautId ? `${path}?astronaut_id=${encodeURIComponent(astronautId)}` : path;
  }

  getLatestSensors(astronautId?: string) {
    return this.request<SensorReading[]>(this.scoped(API_ENDPOINTS.sensorsLatest, astronautId));
  }

  getSignalHistory(query: SignalHistoryQuery) {
    const params = new URLSearchParams({
      channel: query.channel,
      window: String(query.windowSeconds),
      limit: String(query.limit ?? 600),
      filtered: String(query.filtered ?? true),
    });
    if (query.astronautId) params.set('astronaut_id', query.astronautId);
    return this.request<SignalData>(`${API_ENDPOINTS.signalsHistory}?${params.toString()}`);
  }

  getAnomalies(astronautId?: string) {
    return this.request<Anomaly[]>(this.scoped(API_ENDPOINTS.anomalies, astronautId));
  }

  getWitnessChannels(astronautId?: string) {
    return this.request<WitnessChannel[]>(this.scoped(API_ENDPOINTS.witnessChannels, astronautId));
  }

  connectTelemetry(handlers: TelemetrySocketHandlers) {
    if (!this.config.socketUrl) {
      handlers.onStatus?.('error', 'No WebSocket URL configured (VITE_NEXUS_WS_URL).');
      return () => undefined;
    }
    handlers.onStatus?.('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${this.config.socketUrl}${API_ENDPOINTS.telemetrySocket}`);
    } catch (error) {
      handlers.onStatus?.('error', (error as Error).message);
      return () => undefined;
    }
    socket.onopen = () => handlers.onStatus?.('open');
    socket.onerror = () => handlers.onStatus?.('error', 'Telemetry socket error.');
    socket.onclose = () => handlers.onStatus?.('closed');
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type?: string; payload?: unknown };
        if (msg.type === 'snapshot') handlers.onSnapshot?.(msg.payload);
        if (msg.type === 'anomaly') handlers.onAnomaly?.(msg.payload as Anomaly);
        if (msg.type === 'event') handlers.onEvent?.(msg.payload);
      } catch {
        handlers.onStatus?.('error', 'Malformed telemetry frame received.');
      }
    };
    return () => socket.close();
  }
}
