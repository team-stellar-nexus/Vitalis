import { Waveform } from '@/components/charts/Waveform';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const PREVIEW_SAMPLES = 500;

/** Small homepage preview of the astronaut's live PPG buffer. */
export function WaveformPreview() {
  const { snapshot } = useTelemetry();
  const navigate = useNavigate();

  const points = useMemo(() => snapshot.signal.ppg.slice(-PREVIEW_SAMPLES), [snapshot.signal.ppg]);

  return (
    <Panel
      bracket
      eyebrow="Latest physiological waveform · PPG"
      title="Signal preview"
      actions={
        <Button size="sm" variant="ghost" onClick={() => navigate('/signal-analysis')}>
          Signal Observatory <ArrowRight size={13} />
        </Button>
      }
      footer={
        <span className="flex flex-wrap items-center justify-between gap-2 text-[13px] uppercase tracking-micro text-muted/70">
          <span>
            {points.length} samples · last ~{Math.round(points.length / 50)} s · {snapshot.health.sampleRateHz ?? 50} Hz
          </span>
          <span>Full waveforms, residuals and spectrogram in the observatory</span>
        </span>
      }
    >
      <Waveform
        points={points}
        height={120}
        ariaLabel={`Photoplethysmography preview, ${points.length} samples from the current buffer`}
      />
    </Panel>
  );
}