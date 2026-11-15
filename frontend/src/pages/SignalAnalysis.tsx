import { SpectrogramPlot } from '@/components/charts/Spectrogram';
import { TrendChart } from '@/components/charts/TrendChart';
import { Waveform } from '@/components/charts/Waveform';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import type { WindowSeconds } from '@/lib/types';
import { downloadBlob } from '@/lib/utils';
import { useTelemetry } from '@/state/TelemetryProvider';
import { Download, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildSpectrogram } from '@/simulation/signal';

type AnalysisChannel = 'ppg' | 'hrv' | 'spo2' | 'temp';
type WindowFn = 'hann' | 'hamming' | 'blackman';

const CHANNEL_LABEL: Record<AnalysisChannel, string> = {
  ppg: 'PPG',
  hrv: 'HRV',
  spo2: 'SpO₂',
  temp: 'Skin temp',
};

const CHANNEL_COLOR: Record<AnalysisChannel, string> = {
  ppg: '#35D9F2',
  hrv: '#9675FF',
  spo2: '#438AFF',
  temp: '#FFB84D',
};

export function SignalAnalysis() {
  const { snapshot } = useTelemetry();
  const [channel, setChannel] = useState<AnalysisChannel>('ppg');
  const [range, setRange] = useState<WindowSeconds>(60);
  const [low, setLow] = useState(0.5);
  const [high, setHigh] = useState(8);
  const [overlap, setOverlap] = useState(75);
  const [windowFn, setWindowFn] = useState<WindowFn>('hann');
  const [detrend, setDetrend] = useState(true);
  const [showPsd, setShowPsd] = useState(true);

  const intensity =
    channel === 'hrv'
      ? snapshot.anomaly.status === 'confirmed'
        ? 1
        : snapshot.anomaly.status === 'suspected'
          ? 0.62
          : 0.05
      : snapshot.anomaly.status === 'confirmed'
        ? 0.45
        : snapshot.anomaly.status === 'suspected'
          ? 0.28
          : 0.04;
  const bucket = Math.floor(snapshot.simTime / 5);
  const safeHigh = Math.max(low + 1, high);

  const data = useMemo(
    () =>
      buildSpectrogram({
        rangeSeconds: range,
        intensity,
        hr: Math.round(snapshot.vitals.hr / 2) * 2,
        seed: range + bucket * 0.31 + overlap * 0.11 + (windowFn === 'hann' ? 1 : windowFn === 'hamming' ? 2 : 3),
        frequencyRange: [low, safeHigh],
        timeBins: range === 30 ? 72 : range === 60 ? 92 : range === 120 ? 108 : 124,
      }),
    [range, intensity, snapshot.vitals.hr, bucket, overlap, windowFn, low, safeHigh],
  );

  const psd = useMemo(
    () =>
      data.freqs.map((f, i) => ({
        f: Number(f.toFixed(2)),
        power: Number(
          (data.z[i].reduce((a, b) => a + b, 0) / (data.z[i].length || 1)).toFixed(4),
        ),
      })),
    [data],
  );

  const preview = useMemo(() => {
    if (channel === 'ppg') return snapshot.signal.ppg;
    if (channel === 'hrv') return snapshot.signal.hrvTrend;
    if (channel === 'spo2') return snapshot.signal.spo2Trend;
    return snapshot.history.slice(-60).map((p) => ({ t: p.t, v: p.temp }));
  }, [channel, snapshot]);

  const maxPreviewT = preview[preview.length - 1]?.t ?? 0;

  const exportMatrix = () => {
    const header = ['time_s', ...data.freqs.map((f) => f.toFixed(2))].join(',');
    const rows = data.times.map((t, ti) =>
      [t.toFixed(2), ...data.freqs.map((_, fi) => data.z[fi][ti].toFixed(4))].join(','),
    );
    downloadBlob(
      new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }),
      `vitalis-spectrogram-${channel}-${range}s-demo.csv`,
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Stage 1 · preprocessing and time-frequency analysis"
        title="Signal Analysis"
        description="Simulated STFT view of the wearable stream. Filter band, window length, overlap and taper feed the spectrogram matrix that the autoencoder would consume."
        actions={
          <>
            <Badge tone="cyan">SIMULATED STFT</Badge>
            <Button size="sm" variant="outline" onClick={exportMatrix}>
              <Download size={12} /> Export matrix CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Panel
            bracket
            eyebrow="Interactive time-frequency · hover for power"
            title={`${CHANNEL_LABEL[channel]} Spectrogram`}
            actions={
              <Segmented
                label="Time range"
                options={[
                  { value: 30, label: '30s' },
                  { value: 60, label: '60s' },
                  { value: 120, label: '120s' },
                  { value: 240, label: '240s' },
                ]}
                value={range}
                onChange={(v) => setRange(v as WindowSeconds)}
              />
            }
            bodyClassName="p-2"
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-micro text-muted">
                <span>
                  {low.toFixed(1)}–{safeHigh.toFixed(1)} Hz · {windowFn} · {overlap}% overlap ·{' '}
                  {detrend ? 'detrended' : 'raw'}
                </span>
                <span>{data.z.length} freq × {data.z[0]?.length ?? 0} time bins</span>
              </div>
            }
          >
            <SpectrogramPlot data={data} height={386} ariaLabel={`${CHANNEL_LABEL[channel]} spectrogram`} />
          </Panel>

          <div className="mt-3">
            <Panel
              eyebrow="Band-pass chain"
              title="Preprocessing & Filters"
              actions={
                <button
                  type="button"
                  onClick={() => {
                    setLow(0.5);
                    setHigh(8);
                    setOverlap(75);
                    setWindowFn('hann');
                    setDetrend(true);
                  }}
                  className="font-mono text-[9px] uppercase tracking-micro text-muted hover:text-cyan"
                >
                  Reset filters
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="label-xs mb-1.5">Signal channel</div>
                  <Segmented
                    label="Signal channel"
                    options={[
                      { value: 'ppg', label: 'PPG' },
                      { value: 'hrv', label: 'HRV' },
                      { value: 'spo2', label: 'SpO₂' },
                      { value: 'temp', label: 'TEMP' },
                    ]}
                    value={channel}
                    onChange={(v) => setChannel(v as AnalysisChannel)}
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-micro text-muted">
                        <span>Low cut</span>
                        <span className="text-ink">{low.toFixed(1)} Hz</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={2}
                        step={0.1}
                        value={low}
                        aria-label="Low cut frequency"
                        onChange={(e) => setLow(Number(e.target.value))}
                        className="w-full"
                        style={{ accentColor: '#35D9F2' }}
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-micro text-muted">
                        <span>High cut</span>
                        <span className="text-ink">{high.toFixed(1)} Hz</span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={12}
                        step={0.5}
                        value={high}
                        aria-label="High cut frequency"
                        onChange={(e) => setHigh(Number(e.target.value))}
                        className="w-full"
                        style={{ accentColor: '#35D9F2' }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="label-xs mb-1.5">Window function</div>
                    <select
                      value={windowFn}
                      onChange={(e) => setWindowFn(e.target.value as WindowFn)}
                      aria-label="STFT window function"
                      className="h-8 w-full rounded border border-line bg-base px-2 font-mono text-[10px] uppercase tracking-micro text-ink"
                    >
                      <option value="hann">Hann</option>
                      <option value="hamming">Hamming</option>
                      <option value="blackman">Blackman</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="label-xs mb-1.5">STFT overlap</div>
                  <Segmented
                    label="STFT overlap"
                    options={[
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 90, label: '90%' },
                    ]}
                    value={overlap}
                    onChange={(v) => setOverlap(Number(v))}
                  />

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center justify-between gap-3 rounded border border-line-soft bg-base/40 px-2.5 py-2">
                      <span className="text-[11px] text-ink">Baseline detrend</span>
                      <input
                        type="checkbox"
                        checked={detrend}
                        onChange={(e) => setDetrend(e.target.checked)}
                        className="h-3.5 w-3.5"
                        style={{ accentColor: '#35D9F2' }}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded border border-line-soft bg-base/40 px-2.5 py-2">
                      <span className="text-[11px] text-ink">Show power spectral density</span>
                      <input
                        type="checkbox"
                        checked={showPsd}
                        onChange={(e) => setShowPsd(e.target.checked)}
                        className="h-3.5 w-3.5"
                        style={{ accentColor: '#35D9F2' }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded border border-line-soft bg-base/40 p-2.5">
                    <div className="label-xs mb-1 flex items-center gap-1">
                      <SlidersHorizontal size={10} /> Pipeline summary
                    </div>
                    <p className="font-mono text-[9px] leading-relaxed text-muted">
                      Resample 25 Hz → band-pass {low.toFixed(1)}–{safeHigh.toFixed(1)} Hz → {windowFn}{' '}
                      taper → STFT ({range}s, {overlap}% overlap) → normalise → CAE input
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="min-w-0 space-y-3 xl:col-span-4">
          <Panel eyebrow="Spectral estimate" title="Signal Statistics" bodyClassName="p-0">
            <div className="grid grid-cols-2 gap-px bg-line-soft">
              {[
                { label: 'Peak frequency', value: data.stats.peakFreq.toFixed(2), unit: 'Hz' },
                { label: 'Peak power', value: data.stats.peakPower.toFixed(3), unit: 'norm' },
                { label: 'SNR estimate', value: data.stats.snr.toFixed(1), unit: 'dB' },
                { label: 'Spectral entropy', value: data.stats.entropy.toFixed(3), unit: '' },
                { label: 'Band energy', value: data.stats.bandEnergy.toFixed(2), unit: '' },
                { label: 'Resolution', value: ((safeHigh - low) / data.z.length).toFixed(2), unit: 'Hz/bin' },
              ].map((stat) => (
                <div key={stat.label} className="bg-panel px-3 py-2.5">
                  <div className="font-mono text-[8px] uppercase tracking-micro text-muted">{stat.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="font-mono text-[16px] tabular-nums text-ink">{stat.value}</span>
                    <span className="font-mono text-[8px] text-muted">{stat.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft px-3 py-2 font-mono text-[9px] leading-relaxed text-muted">
              Metrics are derived from the simulated matrix, not measured physiology.
            </div>
          </Panel>

          <Panel
            eyebrow="Magnitude spectrum · time-averaged"
            title="Power Spectral Density"
            bodyClassName="p-2.5"
          >
            {showPsd ? (
              <TrendChart
                data={psd}
                xKey="f"
                series={[{ key: 'power', label: 'Power', color: CHANNEL_COLOR[channel], type: 'area' }]}
                height={166}
                tickFormatter={(v) => `${v.toFixed(1)}`}
                tooltipLabel={(v) => `${Number(v).toFixed(2)} Hz`}
                tooltipDecimals={3}
              />
            ) : (
              <div className="flex h-[166px] items-center justify-center rounded border border-dashed border-line text-[10px] text-muted">
                PSD display disabled
              </div>
            )}
            <p className="mt-1 px-1 font-mono text-[8px] uppercase tracking-micro text-muted">
              x · frequency (Hz) · y · mean normalised power
            </p>
          </Panel>

          <Panel
            eyebrow={`${CHANNEL_LABEL[channel]} · raw preview`}
            title="Time Domain Signal"
            bodyClassName="p-3"
          >
            <Waveform
              points={preview}
              color={CHANNEL_COLOR[channel]}
              height={104}
              showScan={false}
              ariaLabel={`${CHANNEL_LABEL[channel]} time domain preview`}
            />
            <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-micro text-muted">
              <span>−{Math.round(maxPreviewT - (preview[0]?.t ?? maxPreviewT))}s</span>
              <span>latest</span>
            </div>
          </Panel>

          <Panel eyebrow="Stage 1 checklist" title="Pipeline Status" bodyClassName="p-0">
            <div className="divide-y divide-line-soft">
              {[
                ['Uniform resample', '25 Hz'],
                ['Band-pass filter', `${low.toFixed(1)}–${safeHigh.toFixed(1)} Hz`],
                ['Window durations', '30 / 60 / 120 / 240 s'],
                ['Time-frequency transform', `STFT · ${windowFn}`],
                ['Normalisation', 'zero mean · unit variance'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="h-1 w-1 rounded-full bg-green" />
                  <span className="text-[10px] text-muted">{label}</span>
                  <span className="ml-auto font-mono text-[9px] text-ink">{value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
