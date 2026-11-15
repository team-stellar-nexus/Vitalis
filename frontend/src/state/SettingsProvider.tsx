import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DemoScenario } from '@/lib/types';

export type ThemeId = 'dark' | 'contrast' | 'night';

export interface Settings {
  theme: ThemeId;
  refreshMs: number;
  speed: number;
  reduceMotion: boolean;
  showGrid: boolean;
  soundAlerts: boolean;
  dropout: boolean;
  scenario: DemoScenario;
}

const DEFAULTS: Settings = {
  theme: 'dark',
  refreshMs: 1000,
  speed: 1,
  reduceMotion: false,
  showGrid: true,
  soundAlerts: false,
  dropout: false,
  scenario: 'normal',
};

const STORAGE_KEY = 'vitalis.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage is optional; the dashboard still works without it.
    }
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.reduceMotion = String(settings.reduceMotion);
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
