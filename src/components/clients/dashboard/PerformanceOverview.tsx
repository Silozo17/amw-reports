import { Card, CardContent } from '@/components/ui/card';
import { PLATFORM_LABELS } from '@/types/database';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
} from 'recharts';

const CHART_COLORS = ['#b32fbf', '#539BDB', '#4ED68E', '#EE8733', '#241f21', '#8b5cf6'];

interface PerformanceOverviewProps {
  spendByPlatform: Array<{ name: string; value: number }>;
  totalSpend: number;
  currSymbol: string;
  engagementStackedData: Array<Record<string, unknown>>;
  impressionsByPlatform: Array<Record<string, unknown>>;
  trendChartData: Array<Record<string, unknown>>;
}

const PerformanceOverview = ({
  spendByPlatform,
  totalSpend,
  currSymbol,
  engagementStackedData,
  impressionsByPlatform,
  trendChartData,
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
                    <RechartsTooltip />
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
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
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
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-body">Performance Trend</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    {trendKeys.map((tk) => (
                      <defs key={`def-${tk.key}`}>
                        <linearGradient id={`trend-grad-${tk.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={tk.color} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={tk.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    ))}
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip />
                    {trendKeys.map((tk) => (
                      <Area
                        key={tk.key}
                        type="monotone"
                        dataKey={tk.key}
                        name={tk.name}
                        stroke={tk.color}
                        strokeWidth={2}
                        fill={`url(#trend-grad-${tk.key})`}
                        dot={{ r: 2, fill: tk.color }}
                      />
                    ))}
                    <Legend />
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
