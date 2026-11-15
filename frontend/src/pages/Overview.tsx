import { ScenarioControl } from '@/components/layout/ScenarioControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConcernsRecommendations } from '@/components/mission/ConcernsRecommendations';
import { EventTimeline } from '@/components/mission/EventTimeline';
import { HealthConclusions } from '@/components/mission/HealthConclusions';
import { HealthSnapshot } from '@/components/mission/HealthSnapshot';
import { MeasurementOverview } from '@/components/mission/MeasurementOverview';
import { MissionStatusHeader } from '@/components/mission/MissionStatusHeader';
import { SignalObservatory } from '@/components/mission/SignalObservatory';
import { WaveformPreview } from '@/components/mission/WaveformPreview';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useTelemetry } from '@/state/TelemetryProvider';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Overview() {
  const { snapshot, mode } = useTelemetry();
  const live = mode === 'live';
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        eyebrow={`Mission control · ${snapshot.mission.id} · ${snapshot.astronaut.name}`}
        title="Mission Health Overview"
        description={
          live
            ? 'Executive summary of the trained backend model for this astronaut. Open Health Intelligence for the full indicator-by-indicator readout, probabilities, and detailed evidence.'
            : 'Evidence-linked health conclusions drawn from baseline-relative physiological signals. Switch to Live for real backend inference; full model details are on the Health Intelligence page.'
        }
        actions={
          <>
            {live ? (
              <Badge tone="amber" dot pulse>
                LIVE · BACKEND MODEL
              </Badge>
            ) : (
              <Badge tone="cyan" dot pulse>
                DEMO · SYNTHETIC
              </Badge>
            )}
            <ScenarioControl />
            <Button size="sm" variant="outline" onClick={() => navigate('/mission-reports')}>
              <FileText size={12} /> Mission report
            </Button>
          </>
        }
      />

      <MissionStatusHeader />

      {live ? (
        <>
          <HealthSnapshot />
          <div className="mt-3">
            <WaveformPreview />
          </div>
        </>
      ) : (
        <HealthConclusions />
      )}

      {live && (
        <div className="mb-2 mt-4 flex flex-wrap items-center gap-2 rounded border border-amber/25 bg-amber/[0.06] px-3 py-2 text-[13px] uppercase tracking-micro text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          Simulated sections below come from the demo engine, not the backend model
        </div>
      )}
      <ConcernsRecommendations />

      <div className="mb-2 mt-5 flex items-end justify-between gap-2 border-b border-line/70 pb-1.5">
        <div>
          <div className="label-xs">Supporting evidence</div>
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">Signal Analysis</h2>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-micro text-muted/60">
          Open a conclusion above to focus its evidence
        </span>
      </div>

      <SignalObservatory />

      <div className="mb-3">
        <MeasurementOverview />
      </div>

      <EventTimeline limit={14} showAllLink />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/60 pt-2 font-mono text-[11px] uppercase tracking-micro text-muted/70">
        <span>Windows evaluated: {snapshot.fusion.flaggedCount}/4 flagged</span>
        <span>Model: {snapshot.model.name}</span>
        <span>Threshold: {snapshot.model.thresholdRule}</span>
        <span>Witness rule: ≥1 co-affected channel</span>
        <span className="text-muted/50">Synthetic physiology · monitoring only · not a diagnosis</span>
      </div>
    </div>
  );
}
