import { ModelReadout } from '@/components/health/ModelReadout';
import { PageHeader } from '@/components/layout/PageHeader';
import { HealthConclusions } from '@/components/mission/HealthConclusions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useTelemetry } from '@/state/TelemetryProvider';
import { useVitalisBackend } from '@/state/VitalisBackendProvider';
import { ArrowUpRight, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Health Intelligence — the complete AI model readout for the selected
 * astronaut. In LIVE mode this is the FastAPI `/report` output; in DEMO mode it
 * falls back to the simulated conclusions, clearly labelled, and points the
 * operator at Live mode for backend results.
 */
export function HealthIntelligence() {
  const { snapshot, mode, setMode } = useTelemetry();
  const { backendUrl, state } = useVitalisBackend();
  const navigate = useNavigate();
  const live = mode === 'live';

  return (
    <div>
      <PageHeader
        eyebrow={`Health intelligence · ${snapshot.mission.id} · ${snapshot.astronaut.name}`}
        title="Health Intelligence"
        description={
          live
            ? 'Every value on this page comes from the trained classifier and signal formulas in the FastAPI backend, evaluated on this astronaut’s own PPG window. Indicators the model cannot support are reported as unavailable rather than estimated.'
            : 'The backend readout needs Live mode. This page currently shows the simulated conclusions so the page is never empty; switch to Live to see the trained model’s actual output.'
        }
        actions={
          <>
            {live ? (
              <Badge tone="amber" dot pulse className="!text-[12px]">
                LIVE · REAL INFERENCE
              </Badge>
            ) : (
              <Badge tone="cyan" dot pulse className="!text-[12px]">
                DEMO · SYNTHETIC
              </Badge>
            )}
            {!live && (
              <Button size="sm" variant="primary" onClick={() => setMode('live')}>
                <Radio size={13} /> Switch to Live
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate('/signal-analysis')}>
              Signal Observatory <ArrowUpRight size={13} />
            </Button>
          </>
        }
      />

      {live ? (
        <>
          <LiveModeNotice />
          <ModelReadout />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-cyan/25 bg-cyan/[0.05] px-4 py-3">
            <Radio size={15} className="text-cyan" />
            <span className="text-[15px] text-ink/90">
              Simulated conclusions below. The backend model readout appears here once Live mode is on
              {state === 'online' ? ` (${backendUrl} is reachable).` : '.'}
            </span>
          </div>
          <HealthConclusions />
        </>
      )}
    </div>
  );
}

/**
 * Separates what the FastAPI backend computes from what this prototype still
 * generates in the browser, so a model result is never read as a measured one.
 */
function LiveModeNotice() {
  const { backendUrl, state, health } = useVitalisBackend();
  return (
    <section className="mb-5 rounded-lg border border-line-soft bg-base/25 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-medium text-cyan">Live mode · real inference, simulated sensor</span>
        <span className="font-mono text-[13px] text-muted/70">
          {backendUrl} · {state}
          {health ? ` · model ${health.model.loaded ? 'loaded' : 'not loaded'}` : ''}
        </span>
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <p className="text-[15px] leading-relaxed text-muted">
          <span className="text-green">Backend:</span> classifier probabilities, every <span className="text-ink/80">/report</span>{' '}
          indicator (model, signal, proxy, unavailable), backend notes and the medical-device disclaimer.
        </p>
        <p className="text-[15px] leading-relaxed text-muted">
          <span className="text-amber">Local prototype:</span> the PPG input comes from the sensor generator (no device
          attached); fusion windows, witness channels, event log and spectrogram are computed in the browser.
        </p>
      </div>
    </section>
  );
}
