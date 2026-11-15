import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  unit?: string;
  type?: 'line' | 'area';
  dashed?: boolean;
  strokeWidth?: number;
}

export interface ReferenceSpec {
  y: number;
  label: string;
  color: string;
  dashed?: boolean;
}

interface TrendChartProps {
  data: Array<Record<string, number>>;
  series: ChartSeries[];
  height?: number;
  xKey?: string;
  yDomain?: [number | 'auto', number | 'auto'];
  tickFormatter?: (value: number) => string;
  tooltipLabel?: (value: number) => string;
  referenceLines?: ReferenceSpec[];
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
  tooltipDecimals?: number;
  syncId?: string;
}

const AXIS = { fill: '#8296AD', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' };

function TelemetryTooltip({
  active,
  payload,
  label,
  series,
  tooltipLabel,
  decimals,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string; color?: string }>;
  label?: number | string;
  series: ChartSeries[];
  tooltipLabel?: (value: number) => string;
  decimals: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-[#0A1320]/95 px-2.5 py-2 shadow-panel backdrop-blur">
      <div className="label-xs mb-1.5">
        {tooltipLabel && typeof label === 'number' ? tooltipLabel(label) : label}
      </div>
      <div className="space-y-1">
        {payload.map((entry) => {
          const meta = series.find((s) => s.key === entry.dataKey);
          if (!meta) return null;
          const value = typeof entry.value === 'number' ? entry.value : Number(entry.value);
          return (
            <div key={String(entry.dataKey)} className="flex items-center gap-2 text-[10px]">
              <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
              <span className="text-muted">{meta.label}</span>
              <span className="ml-auto font-mono tabular-nums text-ink">
                {Number.isFinite(value) ? value.toFixed(decimals) : '—'}
                <span className="ml-0.5 text-muted">{meta.unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  series,
  height = 220,
  xKey = 't',
  yDomain = ['auto', 'auto'],
  tickFormatter,
  tooltipLabel,
  referenceLines = [],
  showGrid = true,
  showLegend = false,
  className,
  tooltipDecimals = 1,
  syncId,
}: TrendChartProps) {
  return (
    <div className={cn('w-full', className)}>
      {showLegend && (
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-micro text-muted">
              <span className="h-[2px] w-3 rounded" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 2, left: 0 }} syncId={syncId}>
          {showGrid && (
            <CartesianGrid stroke="rgba(27,48,71,0.5)" strokeDasharray="2 4" vertical={false} />
          )}
          <XAxis
            dataKey={xKey}
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: 'rgba(27,48,71,0.9)' }}
            tickFormatter={tickFormatter}
            minTickGap={30}
            height={20}
          />
          <YAxis
            domain={yDomain}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(v: number) => `${Math.round(v * 10) / 10}`}
          />
          <Tooltip
            content={
              <TelemetryTooltip
                series={series}
                tooltipLabel={tooltipLabel}
                decimals={tooltipDecimals}
              />
            }
            cursor={{ stroke: 'rgba(53,217,242,0.35)', strokeDasharray: '3 3' }}
          />
          {referenceLines.map((ref) => (
            <ReferenceLine
              key={`${ref.label}-${ref.y}`}
              y={ref.y}
              stroke={ref.color}
              strokeDasharray={ref.dashed === false ? undefined : '4 4'}
              strokeOpacity={0.75}
              label={{
                value: ref.label,
                position: 'insideTopRight',
                fill: ref.color,
                fontSize: 8,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          ))}
          {series.map((s) =>
            s.type === 'area' ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 1.5}
                fill={s.color}
                fillOpacity={0.12}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 2.5, strokeWidth: 0 }}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 1.5}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 2.5, strokeWidth: 0 }}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
