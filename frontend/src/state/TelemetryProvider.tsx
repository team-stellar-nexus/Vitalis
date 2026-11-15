import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { playAlertTone } from '@/lib/audio';
import {
  CREW_PROFILES,
  DEFAULT_PROFILE,
  getProfile,
  type AstronautProfile,
} from '@/lib/crew';
import type { AnomalyStatus, DataMode, MissionEvent, TelemetrySnapshot } from '@/lib/types';
import { HttpNexusApi, type ConnectionState } from '@/services/contracts';
import { SimulationEngine } from '@/simulation/engine';
import { useSettings } from '@/state/SettingsProvider';

export interface LiveState {
  state: ConnectionState;
  detail?: string;
  configured: boolean;
}

export interface AlertToast {
  id: number;
  status: AnomalyStatus;
  score: number;
  timestamp: number;
}

export interface CrewMemberSnapshot {
  profile: AstronautProfile;
  snapshot: TelemetrySnapshot;
}

interface TelemetryContextValue {
  snapshot: TelemetrySnapshot;
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  live: LiveState;
  retryLive: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  profiles: CrewMemberSnapshot[];
  activeProfile: AstronautProfile;
  selectProfile: (profileId: string) => void;
  notifications: {
    events: MissionEvent[];
    unread: number;
    markAllRead: () => void;
    lastSeen: number;
  };
  toast: AlertToast | null;
  dismissToast: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);
const ACTIVE_PROFILE_KEY = 'vitalis.active-profile.v1';
const DATA_MODE_KEY = 'vitalis.data-mode.v1';

function loadActiveProfileId(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (stored && CREW_PROFILES.some((profile) => profile.profileId === stored)) return stored;
  } catch {
    // Storage is optional; fall back to the first profile.
  }
  return DEFAULT_PROFILE.profileId;
}

function loadDataMode(): DataMode {
  try {
    const stored = localStorage.getItem(DATA_MODE_KEY);
    if (stored === 'live' || stored === 'demo') return stored;
  } catch {
    // Storage is optional; default to live.
  }
  return 'live';
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { settings, update } = useSettings();
  const enginesRef = useRef<Map<string, SimulationEngine> | null>(null);
  if (!enginesRef.current) {
    const engines = new Map<string, SimulationEngine>();
    CREW_PROFILES.forEach((profile) => {
      engines.set(profile.profileId, new SimulationEngine(profile, profile.demoScenario, settings.refreshMs));
    });
    enginesRef.current = engines;
  }
  const engines = enginesRef.current;

  const [activeProfileId, setActiveProfileId] = useState(loadActiveProfileId);
  const activeEngine = engines.get(activeProfileId) ?? engines.get(DEFAULT_PROFILE.profileId)!;
  const activeProfile = getProfile(activeProfileId);
  const storedSnapshot = useSyncExternalStore(
    activeEngine.subscribe,
    activeEngine.getSnapshot,
    activeEngine.getSnapshot,
  );
  // A profile switch must never render a frame of another astronaut's values.
  const snapshot =
    storedSnapshot.astronaut.profileId === activeProfileId ? storedSnapshot : activeEngine.getSnapshot();

  const [mode, setModeState] = useState<DataMode>(loadDataMode);
  const [live, setLive] = useState<LiveState>(() => ({
    state: 'idle',
    configured: Boolean(import.meta.env.VITE_NEXUS_API_URL),
  }));
  const [liveAttempt, setLiveAttempt] = useState(0);
  const [lastSeen, setLastSeen] = useState(() => Date.now());
  const [toast, setToast] = useState<AlertToast | null>(null);

  useEffect(() => {
    engines.forEach((engine) => engine.start());
    return () => engines.forEach((engine) => engine.dispose());
  }, [engines]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
    } catch {
      // Non-critical preference.
    }
  }, [activeProfileId]);

  useEffect(() => {
    try {
      localStorage.setItem(DATA_MODE_KEY, mode);
    } catch {
      // Non-critical preference.
    }
  }, [mode]);

  useEffect(() => {
    engines.forEach((engine) => engine.setRefreshMs(settings.refreshMs));
  }, [engines, settings.refreshMs]);

  useEffect(() => {
    engines.forEach((engine) => engine.setSpeed(settings.speed));
  }, [engines, settings.speed]);

  useEffect(() => {
    engines.forEach((engine) => engine.setDropout(settings.dropout));
  }, [engines, settings.dropout]);

  // Scenario is a demo control for the selected astronaut only. Switching
  // profiles restores that profile's own staged scenario in selectProfile().
  useEffect(() => {
    activeEngine.setScenario(settings.scenario);
  }, [activeEngine, settings.scenario]);

  // Sound + toast on alert transitions (never on initial mount or crew switch).
  const previousStatus = useRef<AnomalyStatus | null>(null);
  const previousProfileId = useRef(activeProfileId);
  useEffect(() => {
    if (previousProfileId.current !== activeProfileId) {
      previousProfileId.current = activeProfileId;
      previousStatus.current = null;
      return;
    }
    const status = snapshot.anomaly.status;
    if (previousStatus.current === null) {
      previousStatus.current = status;
      return;
    }
    if (status !== previousStatus.current && status !== 'normal') {
      setToast({ id: Date.now(), status, score: snapshot.anomaly.score, timestamp: Date.now() });
      if (settings.soundAlerts) playAlertTone(status === 'confirmed' ? 'confirmed' : 'suspected');
    }
    previousStatus.current = status;
  }, [snapshot.anomaly.status, snapshot.anomaly.score, settings.soundAlerts, activeProfileId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 7200);
    return () => clearTimeout(timer);
  }, [toast]);

  // LIVE mode: attempt the real transport contract and surface a real error state.
  useEffect(() => {
    if (mode !== 'live') {
      setLive((prev) => ({ ...prev, state: 'idle', detail: undefined }));
      return;
    }
    let cancelled = false;
    setLive((prev) => ({ ...prev, state: 'connecting', detail: undefined }));
    const api = new HttpNexusApi();
    api
      .getMissionOverview(activeProfile.id)
      .then(() => {
        if (!cancelled) {
          setLive((prev) => ({
            ...prev,
            state: 'open',
            detail: 'Live transport reachable. Awaiting telemetry frames from the signal service.',
          }));
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setLive((prev) => ({ ...prev, state: 'error', detail: error.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, liveAttempt, activeProfile.id]);

  const setMode = useCallback((next: DataMode) => {
    setModeState(next);
  }, []);

  const retryLive = useCallback(() => setLiveAttempt((n) => n + 1), []);

  const selectProfile = useCallback(
    (profileId: string) => {
      const profile = getProfile(profileId);
      setActiveProfileId(profile.profileId);
      if (settings.scenario !== profile.demoScenario) {
        update({ scenario: profile.demoScenario });
      }
    },
    [settings.scenario, update],
  );

  const pause = useCallback(() => activeEngine.pause(), [activeEngine]);
  const resume = useCallback(() => activeEngine.resume(), [activeEngine]);
  const reset = useCallback(() => activeEngine.reset(), [activeEngine]);

  const markAllRead = useCallback(() => setLastSeen(Date.now()), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const profiles = useMemo<CrewMemberSnapshot[]>(
    () =>
      CREW_PROFILES.map((profile) => {
        const engine = engines.get(profile.profileId)!;
        const current = engine.getSnapshot();
        return {
          profile,
          // Guarantee the selected crew member's snapshot is the one just rendered.
          snapshot:
            profile.profileId === activeProfileId && current.astronaut.profileId !== activeProfileId
              ? activeEngine.getSnapshot()
              : current,
        };
      }),
    [engines, activeProfileId, activeEngine, snapshot],
  );

  const value = useMemo<TelemetryContextValue>(
    () => ({
      snapshot,
      mode,
      setMode,
      live,
      retryLive,
      pause,
      resume,
      reset,
      profiles,
      activeProfile,
      selectProfile,
      notifications: {
        events: snapshot.events,
        unread: snapshot.events.filter((e) => e.timestamp > lastSeen).length,
        markAllRead,
        lastSeen,
      },
      toast,
      dismissToast,
    }),
    [
      snapshot,
      mode,
      setMode,
      live,
      retryLive,
      pause,
      resume,
      reset,
      profiles,
      activeProfile,
      selectProfile,
      lastSeen,
      markAllRead,
      toast,
      dismissToast,
    ],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return ctx;
}
