import { SPECTROGRAM_COLORSCALE, type SpectrogramData } from '@/simulation/signal';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import type PlotlyType from 'plotly.js-dist-min';

type PlotlyApi = typeof PlotlyType;

export interface FrequencyMarker {
  freq: number;
  label: string;
  color?: string;
}

const NO_MARKERS: FrequencyMarker[] = [];

/**
 * LIGO Omega-scan inspired time-frequency viewer. Plotly is loaded lazily so
 * the initial dashboard bundle stays light; the trace is re-used via
 * `Plotly.react` on every time-range or scenario change.
 *
 * `markers` draws horizontal reference lines (cardiac fundamental + harmonic)
 * without implying a measured spectral peak.
 */
export function SpectrogramPlot({
  data,
  height = 340,
  showColorbar = true,
  className,
  ariaLabel = 'Time-frequency spectrogram',
  markers = NO_MARKERS,
}: {
  data: SpectrogramData;
  height?: number;
  showColorbar?: boolean;
  className?: string;
  ariaLabel?: string;
  markers?: FrequencyMarker[];
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [plotly, setPlotly] = useState<PlotlyApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    import('plotly.js-dist-min')
      .then((mod) => {
        if (active) setPlotly(mod.default);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!plotly || !el) return;
    const [fMin, fMax] = data.frequencyRange;
    const visibleMarkers = markers.filter((marker) => marker.freq >= fMin && marker.freq <= fMax);

    const trace = {
      type: 'heatmap',
      z: data.z,
      x: data.times,
      y: data.freqs,
      colorscale: SPECTROGRAM_COLORSCALE,
      zmin: 0,
      zmax: 1,
      xgap: 0,
      ygap: 0,
      zsmooth: 'best',
      hoverongaps: false,
      hovertemplate: '%{x:.1f} s · %{y:.2f} Hz<br>normalised power <b>%{z:.2f}</b><extra></extra>',
      showscale: showColorbar,
      colorbar: {
        title: { text: 'PWR', side: 'right', font: { size: 8, color: '#8296AD' } },
        thickness: 7,
        len: 0.8,
        tickfont: { size: 8, color: '#8296AD', family: 'JetBrains Mono, monospace' },
        outlinewidth: 0,
        tickvals: [0, 0.5, 1],
        bgcolor: 'rgba(0,0,0,0)',
      },
    };

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(7,11,20,0.55)',
      margin: { l: 48, r: showColorbar ? 44 : 14, t: 10, b: 38 },
      font: { family: 'JetBrains Mono, monospace', size: 9, color: '#8296AD' },
      xaxis: {
        title: { text: 'TIME RELATIVE TO NOW (S)', font: { size: 8, color: '#8296AD' } },
        tickfont: { size: 8, color: '#8296AD' },
        gridcolor: 'rgba(27,48,71,0.55)',
        zeroline: false,
        showline: true,
        linecolor: 'rgba(27,48,71,1)',
        ticks: 'outside',
        tickcolor: 'rgba(27,48,71,1)',
        ticklen: 3,
      },
      yaxis: {
        title: { text: 'FREQUENCY (Hz)', font: { size: 8, color: '#8296AD' } },
        tickfont: { size: 8, color: '#8296AD' },
        gridcolor: 'rgba(27,48,71,0.55)',
        zeroline: false,
        showline: true,
        linecolor: 'rgba(27,48,71,1)',
        ticks: 'outside',
        tickcolor: 'rgba(27,48,71,1)',
        ticklen: 3,
        range: [fMin, fMax],
      },
      hoverlabel: {
        bgcolor: '#0A1320',
        bordercolor: '#1B3047',
        font: { color: '#EAF3FF', size: 10, family: 'JetBrains Mono, monospace' },
      },
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 0,
          y0: fMin,
          y1: fMax,
          line: { color: 'rgba(53,217,242,0.75)', width: 1, dash: 'dot' },
        },
        ...visibleMarkers.map((marker) => ({
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          y0: marker.freq,
          y1: marker.freq,
          line: { color: marker.color ?? 'rgba(53,217,242,0.5)', width: 1, dash: 'dash' },
        })),
      ],
      annotations: visibleMarkers.map((marker) => ({
        xref: 'paper',
        yref: 'y',
        x: 0.995,
        y: marker.freq,
        text: marker.label,
        showarrow: false,
        xanchor: 'right',
        yanchor: 'bottom',
        font: { size: 7.5, color: marker.color ?? '#8296AD', family: 'JetBrains Mono, monospace' },
        bgcolor: 'rgba(7,11,20,0.62)',
        borderpad: 1,
      })),
      hovermode: 'closest',
      dragmode: false,
    };

    void plotly
      .react(elRef.current, [trace], layout, {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false,
      })
      .catch(() => undefined);
  }, [plotly, data, showColorbar, markers]);

  useEffect(() => {
    const el = elRef.current;
    if (!plotly || !el) return;
    const ro = new ResizeObserver(() => {
      // Route transitions detach the panel briefly; Plotly rejects resize calls
      // on undisplayed divs, so only resize a mounted, laid-out plot.
      if (!el.isConnected || el.clientWidth === 0 || el.clientHeight === 0) return;
      try {
        void Promise.resolve(plotly.Plots.resize(el)).catch(() => undefined);
      } catch {
        // Container can vanish during route transitions.
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [plotly]);

  useEffect(
    () => () => {
      if (elRef.current && plotly) {
        try {
          plotly.purge(elRef.current);
        } catch {
          // Already unmounted.
        }
      }
    },
    [plotly],
  );

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <div
        ref={elRef}
        role="img"
        aria-label={`${ariaLabel}. ${data.rangeSeconds} second window, ${data.frequencyRange[0]} to ${data.frequencyRange[1]} hertz. Simulated data.`}
        className="h-full w-full"
      />
      {!plotly && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded border border-line/60 bg-base/50">
          <div className="label anim-pulse-dot">Loading spectrogram renderer</div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-line">
            <div className="anim-sweep h-full w-1/2 bg-cyan/70" />
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded border border-amber/30 bg-base/80 px-4 text-center">
          <div className="label text-amber">Renderer unavailable</div>
          <p className="max-w-xs text-[11px] text-muted">
            The Plotly bundle could not be loaded. {error}
          </p>
        </div>
      )}
    </div>
  );
}
