import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useChartColors } from '@/hooks/useChartColors';
import { METRIC_LABELS } from '@/types/database';

interface TrendChartProps {
  trendData: Array<{ name: string; [key: string]: number | string }>;
  chartMetricKey: string;
  chartLabel: string;
  platform: string;
}

const TrendChart = ({ trendData, chartMetricKey, chartLabel, platform }: TrendChartProps) => {
  const CHART_COLORS = useChartColors();

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">{chartLabel} — Last 6 Months</p>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${platform}-${chartMetricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v.toLocaleString()} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => value.toLocaleString()}
            />
            <Area
              type="monotone"
              dataKey={chartMetricKey}
              name={chartLabel}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              fill={`url(#grad-${platform}-${chartMetricKey})`}
              dot={{ r: 3, fill: CHART_COLORS[0] }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
