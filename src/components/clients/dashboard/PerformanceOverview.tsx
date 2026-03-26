import { Card, CardContent } from '@/components/ui/card';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
} from 'recharts';

const CHART_COLORS = ['#b32fbf', '#539BDB', '#4ED68E', '#EE8733', '#241f21', '#8b5cf6'];

const fmtNum = (v: number) => v.toLocaleString();

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground tabular-nums">{fmtNum(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

interface PerformanceOverviewProps {
  spendByPlatform: Array<{ name: string; value: number }>;
  totalSpend: number;
  currSymbol: string;
  engagementStackedData: Array<Record<string, unknown>>;
  impressionsByPlatform: Array<Record<string, unknown>>;
  trendChartData: Array<Record<string, unknown>>;
  trendPlatforms?: PlatformType[];
}

const PerformanceOverview = ({
  spendByPlatform,
  totalSpend,
  currSymbol,
  engagementStackedData,
  impressionsByPlatform,
  trendChartData,
  trendPlatforms,
}: PerformanceOverviewProps) => {
  const hasSpend = spendByPlatform.length > 1;
  const hasEngagement = engagementStackedData.length > 0;
  const hasImpressions = impressionsByPlatform.length > 0;
  const hasTrend = trendChartData.length > 1;

  if (!hasSpend && !hasEngagement && !hasImpressions && !hasTrend) return null;

  // Determine which trend keys have data
  const trendKeys: { key: string; name: string; color: string }[] = [];
  if (trendChartData.some(d => (d as Record<string, number>).impressions > 0)) trendKeys.push({ key: 'impressions', name: 'Impressions', color: '#b32fbf' });
  if (trendChartData.some(d => (d as Record<string, number>).clicks > 0)) trendKeys.push({ key: 'clicks', name: 'Clicks', color: '#539BDB' });
  if (trendChartData.some(d => (d as Record<string, number>).engagement > 0)) trendKeys.push({ key: 'engagement', name: 'Engagement', color: '#4ED68E' });
  if (trendChartData.some(d => (d as Record<string, number>).reach > 0)) trendKeys.push({ key: 'reach', name: 'Reach', color: '#EE8733' });

  // Normalize trend data so each metric has its own 0–1 scale
  const normalizedTrendData = (() => {
    if (!hasTrend || trendKeys.length === 0) return trendChartData;
    const ranges = trendKeys.reduce<Record<string, { min: number; max: number }>>((acc, tk) => {
      let min = Infinity, max = -Infinity;
      for (const d of trendChartData) {
        const v = (d as Record<string, number>)[tk.key] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      acc[tk.key] = { min, max };
      return acc;
    }, {});
    return trendChartData.map(d => {
      const row: Record<string, unknown> = { name: (d as Record<string, unknown>).name };
      for (const tk of trendKeys) {
        const v = (d as Record<string, number>)[tk.key] ?? 0;
        const { min, max } = ranges[tk.key];
        row[`_orig_${tk.key}`] = v;
        row[`_norm_${tk.key}`] = max === min ? 0.5 : (v - min) / (max - min);
      }
      return row;
    });
  })();

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => {
          const origKey = entry.dataKey.replace('_norm_', '_orig_');
          const origVal = entry.payload?.[origKey] ?? 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.dataKey.replace('_norm_', '').replace(/^\w/, (c: string) => c.toUpperCase())}:</span>
              <span className="font-medium text-foreground tabular-nums">{fmtNum(origVal)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-body">Performance Overview</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Spend Distribution */}
        {hasSpend && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">Spend Distribution</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spendByPlatform}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      innerRadius="50%"
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {spendByPlatform.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => `${currSymbol}${fmtNum(value)}`} />
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-sm font-bold font-body">
                      {currSymbol}{totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}K` : totalSpend.toFixed(0)}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">
                      Total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Engagement Breakdown */}
        {hasEngagement && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">Engagement Breakdown</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementStackedData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="likes" name="Likes" stackId="stack" fill={CHART_COLORS[0]} />
                    <Bar dataKey="comments" name="Comments" stackId="stack" fill={CHART_COLORS[1]} />
                    <Bar dataKey="shares" name="Shares" stackId="stack" fill={CHART_COLORS[2]} />
                    <Bar dataKey="saves" name="Saves" stackId="stack" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Impressions & Clicks */}
        {hasImpressions && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">Impressions & Clicks</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impressionsByPlatform} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="impressions" name="Impressions" fill="#539BDB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clicks" name="Clicks" fill="#4ED68E" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Trend */}
        {hasTrend && trendKeys.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">Performance Trend</p>
                {trendPlatforms && trendPlatforms.length > 0 && (
                  <div className="flex items-center gap-0.5 ml-auto">
                    <TooltipProvider delayDuration={200}>
                      {trendPlatforms.slice(0, 8).map((p) => (
                        <Tooltip key={p}>
                          <TooltipTrigger asChild>
                            <img
                              src={PLATFORM_LOGOS[p]}
                              alt={PLATFORM_LABELS[p]}
                              className="h-4 w-4 object-contain"
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {PLATFORM_LABELS[p]}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                )}
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={normalizedTrendData}>
                    <defs>
                      {trendKeys.map((tk) => (
                        <linearGradient key={tk.key} id={`grad-trend-${tk.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={tk.color} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={tk.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis hide domain={[0, 1]} />
                    <RechartsTooltip content={<TrendTooltip />} />
                    {trendKeys.map((tk) => (
                      <Area
                        key={tk.key}
                        type="monotone"
                        dataKey={`_norm_${tk.key}`}
                        name={tk.name}
                        stroke={tk.color}
                        strokeWidth={2}
                        fill={`url(#grad-trend-${tk.key})`}
                        dot={{ r: 2, fill: tk.color }}
                      />
                    ))}
                    <Legend formatter={(value: string) => value.replace('_norm_', '').replace(/^\w/, (c: string) => c.toUpperCase())} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PerformanceOverview;
