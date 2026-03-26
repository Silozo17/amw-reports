import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { PLATFORM_LOGOS, PLATFORM_LABELS, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS, getCurrencySymbol, METRIC_LABELS } from '@/types/database';
import { METRIC_EXPLANATIONS } from '@/types/metrics';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import type { PlatformType, JobStatus } from '@/types/database';
import { CheckCircle2, AlertTriangle, Clock, Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { triggerSync } from '@/lib/triggerSync';
import { toast } from 'sonner';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ExternalLink, ImageOff } from 'lucide-react';
import { useState } from 'react';
import MetricTooltip from '@/components/clients/MetricTooltip';

const CHART_COLORS = ['#b32fbf', '#539BDB', '#4ED68E', '#EE8733', '#241f21', '#8b5cf6'];

interface TopContentItem {
  page_name?: string;
  message?: string;
  caption?: string;
  full_picture?: string | null;
  permalink_url?: string | null;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  clicks?: number;
  total_engagement?: number;
  query?: string;
  page?: string;
  impressions?: number;
  ctr?: number;
  position?: number;
  sessions?: number;
  views?: number;
  users?: number;
  source?: string;
  title?: string;
  videoId?: string;
  video_views?: number;
}

interface ConnectionInfo {
  last_sync_at: string | null;
  last_sync_status: JobStatus | null;
  last_error: string | null;
}

interface PlatformSectionProps {
  platform: PlatformType;
  metricsData: Record<string, number>;
  prevMetricsData?: Record<string, number>;
  connection?: ConnectionInfo;
  connectionId?: string;
  topContent?: TopContentItem[];
  trendData?: Array<{ name: string; [key: string]: number | string }>;
  currSymbol: string;
  enabledMetrics?: string[];
  reportMonth: number;
  reportYear: number;
  onSyncComplete?: () => void;
}

/** Priority metrics per platform category */
const AD_PLATFORM_KEY_METRICS = ['impressions', 'clicks', 'ctr', 'spend', 'cpc', 'conversions', 'cost_per_conversion', 'reach'];
const SOCIAL_KEY_METRICS = ['reach', 'impressions', 'engagement', 'likes', 'comments', 'shares', 'total_followers', 'follower_growth', 'profile_visits', 'website_clicks', 'video_views', 'saves', 'reel_count'];
const FACEBOOK_KEY_METRICS = ['views', 'reach', 'engagement', 'reactions', 'comments', 'total_followers', 'new_followers', 'page_views', 'link_clicks', 'shares'];
const ANALYTICS_KEY_METRICS = ['sessions', 'active_users', 'new_users', 'ga_page_views', 'bounce_rate', 'avg_session_duration', 'pages_per_session'];
const GSC_KEY_METRICS = ['search_clicks', 'search_impressions', 'search_ctr', 'search_position'];
const GBP_KEY_METRICS = ['gbp_views', 'gbp_searches', 'gbp_calls', 'gbp_direction_requests', 'gbp_website_clicks', 'gbp_reviews_count', 'gbp_average_rating'];
const YOUTUBE_KEY_METRICS = ['views', 'video_views', 'watch_time', 'subscribers', 'likes', 'comments', 'avg_view_duration'];

const PLATFORM_KEY_METRICS: Record<string, string[]> = {
  google_ads: AD_PLATFORM_KEY_METRICS,
  meta_ads: AD_PLATFORM_KEY_METRICS,
  facebook: FACEBOOK_KEY_METRICS,
  instagram: SOCIAL_KEY_METRICS,
  tiktok: SOCIAL_KEY_METRICS,
  linkedin: SOCIAL_KEY_METRICS,
  google_analytics: ANALYTICS_KEY_METRICS,
  google_search_console: GSC_KEY_METRICS,
  google_business_profile: GBP_KEY_METRICS,
  youtube: YOUTUBE_KEY_METRICS,
};

const COST_METRICS = new Set(['spend', 'cpc', 'cpm', 'cost_per_conversion']);
const PERCENT_METRICS = new Set(['ctr', 'engagement_rate', 'bounce_rate', 'search_ctr', 'conversion_rate', 'audience_growth_rate']);
const DECIMAL_METRICS = new Set(['search_position', 'gbp_average_rating', 'pages_per_session', 'avg_session_duration', 'avg_view_duration', 'frequency']);

const formatMetricValue = (key: string, value: number, currSymbol: string): string => {
  if (COST_METRICS.has(key)) return `${currSymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (PERCENT_METRICS.has(key)) return `${value.toFixed(1)}%`;
  if (DECIMAL_METRICS.has(key)) return value.toFixed(1);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
};

// ─── Single Metric Card ────────────────────────────────────────
const MetricCard = ({
  metricKey,
  value,
  change,
  currSymbol,
}: {
  metricKey: string;
  value: number;
  change?: number;
  currSymbol: string;
}) => {
  const isCost = COST_METRICS.has(metricKey);
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const label = METRIC_LABELS[metricKey] ?? metricKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider font-body truncate">
          {label}
        </p>
        <MetricTooltip metricKey={metricKey} />
      </div>
      <p className="text-xl font-bold font-body tabular-nums leading-none">
        {formatMetricValue(metricKey, value, currSymbol)}
      </p>
      {change !== undefined && (
        <span
          className={cn(
            'inline-flex items-center text-[10px] font-medium',
            isPositive === true ? 'text-accent' :
            isPositive === false ? 'text-destructive' :
            'text-muted-foreground',
          )}
        >
          {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  );
};

// ─── Platform Section ──────────────────────────────────────────
const PlatformSection = ({
  platform,
  metricsData,
  prevMetricsData,
  connection,
  connectionId,
  topContent,
  trendData,
  currSymbol,
  enabledMetrics,
  reportMonth,
  reportYear,
  onSyncComplete,
}: PlatformSectionProps) => {
  const [contentOpen, setContentOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const logo = PLATFORM_LOGOS[platform];
  const label = PLATFORM_LABELS[platform];
  const isOrganic = ORGANIC_PLATFORMS.has(platform);

  // Get key metrics for this platform
  const keyMetricKeys = PLATFORM_KEY_METRICS[platform] ?? [];
  const availableMetrics = keyMetricKeys.filter(key => {
    const val = metricsData[key];
    if (val === undefined || val === null) return false;
    if (HIDDEN_METRICS.has(key)) return false;
    if (isOrganic && AD_METRICS.has(key)) return false;
    if (enabledMetrics && enabledMetrics.length > 0 && !enabledMetrics.includes(key)) return false;
    return true;
  });

  // Also add any remaining metrics not in key list
  const extraMetrics = Object.keys(metricsData).filter(key => {
    if (availableMetrics.includes(key)) return false;
    if (HIDDEN_METRICS.has(key)) return false;
    if (isOrganic && AD_METRICS.has(key)) return false;
    if (enabledMetrics && enabledMetrics.length > 0 && !enabledMetrics.includes(key)) return false;
    if (typeof metricsData[key] !== 'number') return false;
    return true;
  });

  const allMetricKeys = [...availableMetrics, ...extraMetrics];

  // Compute changes
  const computeChange = (key: string): number | undefined => {
    const curr = metricsData[key];
    const prev = prevMetricsData?.[key];
    if (prev && prev !== 0 && curr !== undefined) return ((curr - prev) / prev) * 100;
    return undefined;
  };

  // Sync status
  const syncStatus = connection?.last_sync_status;
  const lastSyncAt = connection?.last_sync_at;

  // Top content for tables
  const socialPosts = (topContent ?? []).filter(p => p.message || p.caption);
  const gscQueries = (topContent ?? []).filter(p => p.query);
  const gscPages = (topContent ?? []).filter(p => p.page && !p.query);
  const gaPages = (topContent ?? []).filter(p => p.page && !p.query && platform === 'google_analytics');
  const gaSources = (topContent ?? []).filter(p => p.source);
  const ytVideos = (topContent ?? []).filter(p => p.title);

  const hasTopContent = socialPosts.length > 0 || gscQueries.length > 0 || gscPages.length > 0 || gaPages.length > 0 || gaSources.length > 0 || ytVideos.length > 0;

  // Determine a chart to show: spend trend for ad platforms, engagement for social
  const isAdPlatform = platform === 'google_ads' || platform === 'meta_ads';
  const chartMetricKey = isAdPlatform ? 'spend' : platform === 'google_analytics' ? 'sessions' : platform === 'google_search_console' ? 'search_clicks' : platform === 'youtube' ? 'views' : 'engagement';
  const hasChartData = trendData && trendData.length > 1 && trendData.some(d => (d[chartMetricKey] as number) > 0);
  const chartLabel = METRIC_LABELS[chartMetricKey] ?? chartMetricKey;

  if (allMetricKeys.length === 0) return null;

  const handleSyncNow = async () => {
    if (!connectionId) {
      toast.error('No connection ID available');
      return;
    }
    setIsSyncing(true);
    const result = await triggerSync(connectionId, platform, reportMonth, reportYear);
    if (result.success) {
      toast.success(`${label} synced for ${reportMonth}/${reportYear}`);
      onSyncComplete?.();
    } else {
      toast.error(`Sync failed: ${result.error}`);
    }
    setIsSyncing(false);
  };

  return (
    <Card className="overflow-hidden">
      {/* Platform Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt="" className="h-6 w-6 object-contain" />}
          <h3 className="text-base font-semibold font-body tracking-wide">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Synced {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
            </span>
          )}
          {connectionId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px] gap-1"
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sync
            </Button>
          )}
          <Badge
            variant={syncStatus === 'success' ? 'default' : syncStatus === 'failed' ? 'destructive' : 'secondary'}
            className="text-[10px] px-1.5 py-0"
          >
            {syncStatus === 'success' ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
            ) : syncStatus === 'failed' ? (
              <><AlertTriangle className="h-3 w-3 mr-1" />Error</>
            ) : (
              <><Wifi className="h-3 w-3 mr-1" />Connected</>
            )}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 space-y-5">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {allMetricKeys.slice(0, 10).map(key => (
            <MetricCard
              key={key}
              metricKey={key}
              value={metricsData[key]}
              change={computeChange(key)}
              currSymbol={currSymbol}
            />
          ))}
        </div>


        {/* Platform-specific explanation */}
        {METRIC_EXPLANATIONS[allMetricKeys[0]] && (
          <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
            {isAdPlatform
              ? 'These metrics show how your paid advertising is performing across campaigns.'
              : platform === 'google_analytics'
              ? 'These metrics show how visitors interact with your website.'
              : platform === 'google_search_console'
              ? 'These metrics show how your site appears in Google search results.'
              : platform === 'google_business_profile'
              ? 'These metrics show how people discover and interact with your Google Business listing.'
              : platform === 'youtube'
              ? 'These metrics show how your YouTube channel and videos are performing.'
              : 'These metrics show how your audience engages with your content on this platform.'}
          </p>
        )}

        {/* Trend Chart */}
        {platform === 'google_search_console' && trendData && trendData.length > 1 ? (() => {
          // Normalize each GSC metric independently to 0–1 so every line fills the chart height
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
              const { min, max } = metricRanges[key];
              const range = max - min;
              normalized[`_norm_${key}`] = range === 0 ? 0.5 : (val - min) / range;
              normalized[`_orig_${key}`] = val; // keep original for tooltip
            }
            return normalized;
          });

          const GscTooltip = ({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 shadow-xl text-xs space-y-1">
                <p className="font-medium text-foreground">{label}</p>
                {payload.map((entry: any) => {
                  const normKey = entry.dataKey as string;
                  const origKey = normKey.replace('_norm_', '');
                  const origValue = entry.payload[`_orig_${origKey}`] as number;
                  const metricLabel = METRIC_LABELS[origKey] ?? origKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                  return (
                    <div key={origKey} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{metricLabel}:</span>
                      <span className="font-medium text-foreground tabular-nums">{formatMetricValue(origKey, origValue, currSymbol)}</span>
                    </div>
                  );
                })}
              </div>
            );
          };

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
                    <YAxis hide domain={[0, 1]} />
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
        })() : hasChartData && (
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
        )}

        {/* Top Content */}
        {hasTopContent && (
          <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', contentOpen && 'rotate-180')} />
              {socialPosts.length > 0 ? 'Top Posts' :
               gscQueries.length > 0 ? 'Top Search Queries' :
               ytVideos.length > 0 ? 'Top Videos' :
               gaPages.length > 0 ? 'Top Pages' :
               gaSources.length > 0 ? 'Traffic Sources' : 'Details'}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {socialPosts.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-2" />
                        <TableHead>Post</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                        <TableHead className="w-10 px-2" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {socialPosts.slice(0, 5).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="w-10 px-2">
                            {p.full_picture ? (
                              <img src={p.full_picture} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ImageOff className="h-3 w-3 text-muted-foreground" /></div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{(p.message || p.caption || 'No caption').slice(0, 80)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(p.reach ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{p.video_views ? p.video_views.toLocaleString() : '—'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(p.likes ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(p.comments ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="w-10 px-2">
                            {p.permalink_url && (
                              <a href={p.permalink_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {gscQueries.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gscQueries.slice(0, 8).map((q, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{q.query}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(q.clicks ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(q.impressions ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{q.ctr != null ? `${(q.ctr * 100).toFixed(1)}%` : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ytVideos.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Video</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ytVideos.slice(0, 5).map((v, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{v.title}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(v.views ?? v.video_views ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(v.likes ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(v.comments ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {gaSources.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gaSources.slice(0, 8).map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{s.source}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(s.sessions ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{(s.users ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformSection;
