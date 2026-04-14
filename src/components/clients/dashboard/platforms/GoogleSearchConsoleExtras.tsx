import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import { useChartColors } from '@/hooks/useChartColors';
import { METRIC_LABELS } from '@/types/database';
import { GSC_KEY_METRICS } from './shared/constants';
import { formatMetricValue } from './shared/formatMetricValue';
import GeoHeatmap from '@/components/clients/dashboard/GeoHeatmap';
import DeviceBreakdown from '@/components/clients/dashboard/DeviceBreakdown';
import type { RawDataItem } from './shared/types';

interface GscChartProps {
  trendData: Array<{ name: string; [key: string]: number | string }>;
  currSymbol: string;
}

export const GscTrendChart = ({ trendData, currSymbol }: GscChartProps) => {
  const CHART_COLORS = useChartColors();

  const activeGscMetrics = GSC_KEY_METRICS.filter(key =>
    trendData.some(d => typeof d[key] === 'number' && (d[key] as number) > 0)
  );

  const metricRanges: Record<string, { min: number; max: number }> = {};
  for (const key of activeGscMetrics) {
    const values = trendData.map(d => (typeof d[key] === 'number' ? (d[key] as number) : 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    metricRanges[key] = { min, max };
  }

  const normalizedData = trendData.map(d => {
    const normalized: Record<string, number | string> = { name: d.name };
    for (const key of activeGscMetrics) {
      const val = typeof d[key] === 'number' ? (d[key] as number) : 0;
      const { max } = metricRanges[key];
      normalized[`_norm_${key}`] = max === 0 ? 0 : val / max;
      normalized[`_orig_${key}`] = val;
    }
    return normalized;
  });

  const GscTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as Array<Record<string, unknown>>)?.length) return null;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs space-y-1">
        <p className="font-medium text-foreground">{String(label)}</p>
        {(payload as Array<Record<string, unknown>>).map((entry: Record<string, unknown>) => {
          const normKey = entry.dataKey as string;
          const origKey = normKey.replace('_norm_', '');
          const origValue = (entry.payload as Record<string, number>)[`_orig_${origKey}`];
          const metricLabel = METRIC_LABELS[origKey] ?? origKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          return (
            <div key={origKey} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color as string }} />
              <span className="text-muted-foreground">{metricLabel}:</span>
              <span className="font-medium text-foreground tabular-nums">{formatMetricValue(origKey, origValue, currSymbol)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (activeGscMetrics.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">Search Performance — Last 6 Months</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={normalizedData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              {activeGscMetrics.map((key, i) => (
                <linearGradient key={key} id={`grad-gsc-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis hide domain={[0, 1.3]} />
            <RechartsTooltip content={<GscTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value: string) => {
                const origKey = value.replace('_norm_', '');
                return METRIC_LABELS[origKey] ?? origKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              }}
            />
            {activeGscMetrics.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={`_norm_${key}`}
                name={`_norm_${key}`}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                fill={`url(#grad-gsc-${key})`}
                dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface GscExtrasProps {
  rawData: Record<string, unknown>;
}

export const GscRawDataExtras = ({ rawData }: GscExtrasProps) => {
  return (
    <>
      {(rawData.topCountries as RawDataItem[])?.length > 0 && (
        <GeoHeatmap
          countries={((rawData.topCountries as RawDataItem[]) || []).map((c: RawDataItem) => ({
            country: String(c.country || (c as Record<string, unknown>).keys?.[0] || 'Unknown'),
            countryId: String(c.countryId || (c as Record<string, unknown>).keys?.[0] || ''),
            users: Number(c.clicks) || 0,
            sessions: Number(c.impressions) || 0,
          }))}
          cities={[]}
        />
      )}
      {(rawData.topDevices as RawDataItem[])?.length > 0 && (
        <DeviceBreakdown
          devices={((rawData.topDevices as RawDataItem[]) || []).map((d: RawDataItem) => ({
            device: String(d.device || (d as Record<string, unknown>).keys?.[0] || 'Unknown'),
            users: Number(d.clicks) || 0,
            sessions: Number(d.impressions) || 0,
          }))}
          newVsReturning={[]}
        />
      )}
    </>
  );
};
