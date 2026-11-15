import { Sidebar } from '@/components/layout/Sidebar';
import { ToastHost } from '@/components/layout/ToastHost';
import { TopBar } from '@/components/layout/TopBar';
import { useSettings } from '@/state/SettingsProvider';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vitalis.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    try {
      localStorage.setItem('vitalis.sidebar', collapsed ? 'collapsed' : 'expanded');
    } catch {
      // Non-critical preference.
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* Ambient mission-control backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            display: settings.showGrid ? undefined : 'none',
            backgroundImage:
              'linear-gradient(to right, rgba(27,48,71,0.32) 1px, transparent 1px), linear-gradient(to bottom, rgba(27,48,71,0.32) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 55% 0%, black 20%, transparent 78%)',
          }}
        />
        <div className="absolute -top-52 left-[26%] h-[440px] w-[760px] rounded-full bg-cyan/[0.05] blur-[130px]" />
        <div className="absolute right-[-10%] top-[28%] h-[420px] w-[520px] rounded-full bg-violet/[0.045] blur-[140px]" />
        <div className="absolute bottom-[-18%] left-[10%] h-[360px] w-[620px] rounded-full bg-blue/[0.035] blur-[130px]" />
      </div>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1640px] px-3 py-4 sm:px-4 lg:px-5 lg:py-5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 pb-1 font-mono text-[9px] uppercase tracking-micro text-muted/80">
              <span>
                VITALIS · Simulation environment · No live astronaut or NASA connection
              </span>
              <span className="flex items-center gap-3">
                <span>Contracts: /api/* · /ws/telemetry</span>
                <span className="text-muted/50">Build 1.0.0</span>
              </span>
            </footer>
          </div>
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
