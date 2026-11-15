import { SpectrogramPlot, type FrequencyMarker } from '@/components/charts/Spectrogram';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { ExpandDialog } from '@/components/ui/ExpandDialog';
import { Segmented } from '@/components/ui/Segmented';
import { Panel } from '@/components/ui/Panel';
import type { WindowSeconds } from '@/lib/types';
import { useTelemetry } from '@/state/TelemetryProvider';
import { ArrowUpRight, Maximize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSpectrogram } from '@/simulation/signal';

/** Section E — Omega-scan style spectrogram for the current signal. */
export function SpectrogramPanel({
  defaultRange = 60,
  height = 400,
}: {
  defaultRange?: WindowSeconds;
  height?: number;
}) {
  const { snapshot } = useTelemetry();
  const [range, setRange] = useState<WindowSeconds>(defaultRange);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const intensity =
    snapshot.anomaly.status === 'confirmed' ? 1 : snapshot.anomaly.status === 'suspected' ? 0.62 : 0.06;
  const bucket = Math.floor(snapshot.simTime / 5);
  const hrBucket = Math.round(snapshot.vitals.hr / 2) * 2;

  const data = useMemo(
    () =>
      buildSpectrogram({
        rangeSeconds: range,
        intensity,
        hr: hrBucket,
        seed: range + bucket * 0.37,
        timeBins: range === 30 ? 72 : range === 60 ? 92 : range === 120 ? 108 : 120,
      }),
    [range, intensity, hrBucket, bucket],
  );

  const markers = useMemo<FrequencyMarker[]>(() => {
    const f0 = hrBucket / 60;
    return [
      { freq: f0, label: `f0 ${f0.toFixed(2)} Hz`, color: 'rgba(53,217,242,0.85)' },
      { freq: f0 * 2, label: `2f0 ${(f0 * 2).toFixed(2)} Hz`, color: 'rgba(150,117,255,0.8)' },
    ];
  }, [hrBucket]);

  const rangeControl = (
    <Segmented
      label="Spectrogram time range"
      options={[
        { value: 30, label: '30s' },
        { value: 60, label: '60s' },
        { value: 120, label: '120s' },
        { value: 240, label: '240s' },
      ]}
      value={range}
      onChange={(v) => setRange(v as WindowSeconds)}
    />
  );

  const statsFooter = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-micro text-muted">
        <span>Peak {data.stats.peakFreq} Hz</span>
        <span>SNR {data.stats.snr}</span>
        <span className="hidden sm:inline">Entropy {data.stats.entropy}</span>
        <span className="hidden md:inline">Band energy {data.stats.bandEnergy}</span>
        <span className="hidden lg:inline">f0 cardiac fundamental · 2f0 harmonic</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[8px] uppercase tracking-micro text-muted">PWR</span>
        <span
          className="h-1.5 w-20 rounded-full"
          style={{
            background:
              'linear-gradient(90deg,#081426,#0E2A44,#186F9E,#438AFF,#9675FF,#35D9F2,#FFD166)',
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <Panel
        bracket
        eyebrow="STFT time-frequency · LIGO Omega-scan inspired"
        title="Signal Spectrogram"
        actions={
          <>
            {rangeControl}
            <IconButton label="Expand spectrogram" onClick={() => setExpanded(true)}>
              <Maximize2 size={13} />
            </IconButton>
            <button
              type="button"
              onClick={() => navigate('/signal-analysis')}
              className="hidden items-center gap-1 font-mono text-[9px] uppercase tracking-micro text-cyan hover:underline sm:flex"
            >
              Analysis <ArrowUpRight size={10} />
            </button>
          </>
        }
        bodyClassName="p-2 pt-2.5"
        footer={statsFooter}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
          <Badge tone="neutral" className="!text-[8px]">
            PPG · {range}s window · 0.5–8 Hz
          </Badge>
          <span className="hidden font-mono text-[8px] uppercase tracking-micro text-muted sm:inline">
            simulated matrix · {data.z[0]?.length ?? 0}×{data.z.length} bins
          </span>
        </div>
        <SpectrogramPlot
          data={data}
          height={height}
          markers={markers}
          ariaLabel="Simulated PPG time-frequency spectrogram with cardiac fundamental marker"
        />
      </Panel>

      <ExpandDialog
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Signal spectrogram · expanded"
        subtitle={`PPG · ${range}s window · 0.5–8 Hz · simulated matrix`}
        footer={statsFooter}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {rangeControl}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[8.5px] uppercase tracking-micro text-muted">
            <span className="flex items-center gap-1">
              <span className="h-px w-4 bg-cyan" /> f0 cardiac fundamental
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-4 bg-violet" /> 2f0 harmonic
            </span>
          </div>
        </div>
        <SpectrogramPlot
          data={data}
          height={520}
          markers={markers}
          ariaLabel="Expanded simulated PPG time-frequency spectrogram"
        />
      </ExpandDialog>
    </>
  );
}
