import { useEffect, useState, useCallback, useMemo } from 'react';
import { subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, DollarSign, Eye, MousePointerClick, Users, BarChart3, PieChartIcon, AlertCircle, Clock } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import PlatformMetricsCard from './PlatformMetricsCard';
import DashboardHeader, { type SelectedPeriod, type PlatformFilter } from './DashboardHeader';
import { PLATFORM_LABELS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from '@/types/database';
import type { PlatformType, JobStatus } from '@/types/database';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const PIE_COLORS = ['#b32fbf', '#539BDB', '#4ED68E', '#EE8733', '#241f21', '#8b5cf6'];

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  currencyCode?: string;
}

interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  report_month: number;
  report_year: number;
}

interface ConnectionData {
  platform: PlatformType;
  last_sync_at: string | null;
  last_sync_status: JobStatus | null;
  last_error: string | null;
}

interface PlatformConfigData {
  platform: PlatformType;
  is_enabled: boolean;
  enabled_metrics: string[];
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ClientDashboard = ({ clientId, clientName, currencyCode = 'GBP' }: ClientDashboardProps) => {
  const currSymbol = getCurrencySymbol(currencyCode);
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({
    type: 'monthly',
    month: defaultMonth,
    year: defaultYear,
  });
  const [hasAutoDetected, setHasAutoDetected] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<SnapshotData[]>([]);
  const [trendData, setTrendData] = useState<SnapshotData[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformType[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [platformConfigs, setPlatformConfigs] = useState<Map<string, PlatformConfigData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Reset auto-detection when client changes
  useEffect(() => {
    setHasAutoDetected(false);
  }, [clientId]);

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    const { month, year, type, startDate, endDate } = selectedPeriod;

    // Build current-period query
    let query = supabase.from('monthly_snapshots')
      .select('platform, metrics_data, report_month, report_year')
      .eq('client_id', clientId);

    // Whether we need multi-month aggregation
    let isMultiMonth = false;

    if (type === 'quarterly') {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      query = query.in('report_month', [qStart, qStart + 1, qStart + 2]).eq('report_year', year);
      isMultiMonth = true;
    } else if (type === 'ytd') {
      const currentMonth = new Date().getMonth() + 1;
      const ytdMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);
      query = query.in('report_month', ytdMonths).eq('report_year', year);
      isMultiMonth = true;
    } else if (type === 'last_year') {
      query = query.eq('report_year', year);
      isMultiMonth = true;
    } else if (type === 'maximum') {
      // No month/year filter — fetch all
      isMultiMonth = true;
    } else if (type === 'custom' && startDate && endDate) {
      const sMonth = startDate.getMonth() + 1;
      const sYear = startDate.getFullYear();
      const eMonth = endDate.getMonth() + 1;
      const eYear = endDate.getFullYear();
      if (sYear === eYear) {
        const customMonths = Array.from({ length: eMonth - sMonth + 1 }, (_, i) => sMonth + i);
        query = query.in('report_month', customMonths).eq('report_year', sYear);
      } else {
        query = query.or(
          `and(report_year.eq.${sYear},report_month.gte.${sMonth}),and(report_year.gt.${sYear},report_year.lt.${eYear}),and(report_year.eq.${eYear},report_month.lte.${eMonth})`
        );
      }
      isMultiMonth = true;
    } else {
      // weekly / monthly — single month
      query = query.eq('report_month', month).eq('report_year', year);
    }

    // Previous period for comparison
    let prevMonth = month;
    let prevYear = year;
    const showComparison = type === 'weekly' || type === 'monthly' || type === 'quarterly';
    if (type === 'quarterly') {
      // Previous quarter
      const d = subMonths(new Date(year, month - 1), 3);
      prevMonth = d.getMonth() + 1;
      prevYear = d.getFullYear();
    } else {
      prevMonth = month === 1 ? 12 : month - 1;
      prevYear = month === 1 ? year - 1 : year;
    }

    // Trend: server-side filter to last 6 months
    const sixMonthsAgo = new Date(year, month - 1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startMonth = sixMonthsAgo.getMonth() + 1;
    const startYear = sixMonthsAgo.getFullYear();

    const [currentRes, prevRes, trendRes, connectionsRes, configRes] = await Promise.all([
      query,
      showComparison
        ? supabase.from('monthly_snapshots').select('platform, metrics_data, report_month, report_year')
            .eq('client_id', clientId).eq('report_month', prevMonth).eq('report_year', prevYear)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('monthly_snapshots').select('platform, metrics_data, report_month, report_year')
        .eq('client_id', clientId)
        .or(`report_year.gt.${startYear},and(report_year.eq.${startYear},report_month.gte.${startMonth})`)
        .order('report_year', { ascending: true }).order('report_month', { ascending: true }),
      supabase.from('platform_connections').select('platform, last_sync_at, last_sync_status, last_error')
        .eq('client_id', clientId).eq('is_connected', true),
      supabase.from('client_platform_config').select('platform, is_enabled, enabled_metrics')
        .eq('client_id', clientId),
    ]);

    // Store connections
    setConnections((connectionsRes.data ?? []) as ConnectionData[]);

    // Store platform configs as a Map
    const configMap = new Map<string, PlatformConfigData>();
    for (const c of (configRes.data ?? []) as PlatformConfigData[]) {
      configMap.set(c.platform, c);
    }
    setPlatformConfigs(configMap);

    // Aggregate multi-month data if needed
    let currentSnapshots = (currentRes.data ?? []) as SnapshotData[];
    if (isMultiMonth && currentSnapshots.length > 0) {
      const grouped = new Map<PlatformType, Record<string, number>>();
      for (const s of currentSnapshots) {
        const existing = grouped.get(s.platform) || {};
        for (const [k, v] of Object.entries(s.metrics_data)) {
          if (typeof v === 'number') {
            existing[k] = (existing[k] || 0) + v;
          }
        }
        grouped.set(s.platform, existing);
      }
      // Recalculate derived rate metrics from totals
      currentSnapshots = Array.from(grouped.entries()).map(([platform, metrics]) => {
        const adjusted = { ...metrics };
        if (adjusted.spend && adjusted.clicks) {
          adjusted.cpc = adjusted.spend / adjusted.clicks;
        }
        if (adjusted.spend && adjusted.conversions) {
          adjusted.cost_per_conversion = adjusted.spend / adjusted.conversions;
        }
        if (adjusted.clicks && adjusted.impressions) {
          adjusted.ctr = (adjusted.clicks / adjusted.impressions) * 100;
        }
        if (adjusted.engagement && adjusted.impressions) {
          adjusted.engagement_rate = (adjusted.engagement / adjusted.impressions) * 100;
        }
        return { platform, metrics_data: adjusted, report_month: month, report_year: year };
      });
    }

    setSnapshots(currentSnapshots);
    setPrevSnapshots((prevRes.data ?? []) as SnapshotData[]);
    setTrendData((trendRes.data ?? []) as SnapshotData[]);

    const platforms = [...new Set((connectionsRes.data ?? []).map((c: any) => c.platform as PlatformType))];
    setAvailablePlatforms(platforms);

    // Smart default: if current period has no real data (all zeros or no snapshots),
    // find the most recent month with non-zero data
    const hasRealData = currentSnapshots.some(snapshot => {
      const metrics = snapshot.metrics_data;
      return Object.entries(metrics).some(([key, v]) =>
        typeof v === 'number' && v > 0 && !HIDDEN_METRICS.has(key)
      );
    });

    if (!hasAutoDetected && !hasRealData && (trendRes.data ?? []).length > 0) {
      const allSnaps = (trendRes.data ?? []) as SnapshotData[];
      const monthsWithData = new Map<string, { m: number; y: number; total: number }>();
      for (const s of allSnaps) {
        const key = `${s.report_year}-${s.report_month}`;
        const existing = monthsWithData.get(key) || { m: s.report_month, y: s.report_year, total: 0 };
        const total = Object.entries(s.metrics_data)
          .filter(([k]) => !HIDDEN_METRICS.has(k))
          .reduce((sum, [, v]) => sum + (typeof v === 'number' ? Math.abs(v) : 0), 0);
        existing.total += total;
        monthsWithData.set(key, existing);
      }
      const sorted = Array.from(monthsWithData.values()).filter(d => d.total > 0).sort((a, b) => {
        if (a.y !== b.y) return b.y - a.y;
        return b.m - a.m;
      });
      if (sorted.length > 0) {
        setSelectedPeriod(prev => ({ ...prev, month: sorted[0].m, year: sorted[0].y }));
      }
      setHasAutoDetected(true);
    } else if (!hasAutoDetected) {
      setHasAutoDetected(true);
    }

    setIsLoading(false);
  }, [clientId, selectedPeriod, hasAutoDetected]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const handleAnalyse = async () => {
    setIsAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-client', {
        body: { client_id: clientId, month: selectedPeriod.month, year: selectedPeriod.year },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAiAnalysis(data.analysis || 'No analysis available.');
    } catch (e) {
      console.error('Analysis error:', e);
      toast.error('Failed to generate AI analysis');
    } finally {
      setIsAnalysing(false);
    }
  };

  // Filter snapshots by selected platform
  const filtered = useMemo(() => {
    if (selectedPlatform === 'all') return snapshots;
    return snapshots.filter(s => s.platform === selectedPlatform);
  }, [snapshots, selectedPlatform]);

  const filteredPrev = useMemo(() => {
    if (selectedPlatform === 'all') return prevSnapshots;
    return prevSnapshots.filter(s => s.platform === selectedPlatform);
  }, [prevSnapshots, selectedPlatform]);

  // KPI Aggregates
  const kpis = useMemo(() => {
    const totalSpend = filtered.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const totalReach = filtered.reduce((sum, s) => sum + (s.metrics_data.reach || s.metrics_data.impressions || 0), 0);
    const totalClicks = filtered.reduce((sum, s) => sum + (s.metrics_data.clicks || 0), 0);
    const totalEngagement = filtered.reduce((sum, s) => sum + (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0), 0);
    const totalFollowers = Math.max(...filtered.map(s => s.metrics_data.total_followers || 0), 0);
    const totalConversions = filtered.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);

    const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const prevReach = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.reach || s.metrics_data.impressions || 0), 0);
    const prevClicks = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.clicks || 0), 0);
    const prevEngagement = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0), 0);

    const calcChange = (curr: number, prev: number) => prev !== 0 ? ((curr - prev) / prev) * 100 : undefined;

    return [
      { label: 'Total Spend', value: totalSpend, formatted: `${currSymbol}${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: calcChange(totalSpend, prevSpend), icon: DollarSign, isCost: true },
      { label: 'Reach / Impressions', value: totalReach, formatted: totalReach >= 1000000 ? `${(totalReach / 1000000).toFixed(1)}M` : totalReach >= 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach.toLocaleString(), change: calcChange(totalReach, prevReach), icon: Eye },
      { label: 'Clicks', value: totalClicks, formatted: totalClicks >= 1000 ? `${(totalClicks / 1000).toFixed(1)}K` : totalClicks.toLocaleString(), change: calcChange(totalClicks, prevClicks), icon: MousePointerClick },
      { label: 'Engagement', value: totalEngagement, formatted: totalEngagement >= 1000 ? `${(totalEngagement / 1000).toFixed(1)}K` : totalEngagement.toLocaleString(), change: calcChange(totalEngagement, prevEngagement), icon: BarChart3 },
      ...(totalFollowers > 0 ? [{ label: 'Followers', value: totalFollowers, formatted: totalFollowers >= 1000 ? `${(totalFollowers / 1000).toFixed(1)}K` : totalFollowers.toLocaleString(), change: undefined as number | undefined, icon: Users }] : []),
      ...(totalConversions > 0 ? [{ label: 'Conversions', value: totalConversions, formatted: totalConversions.toLocaleString(), change: undefined as number | undefined, icon: TrendingUp }] : []),
    ];
  }, [filtered, filteredPrev, currSymbol]);

  // Chart data
  const spendByPlatform = useMemo(() =>
    filtered.filter(s => s.metrics_data.spend > 0).map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      value: Math.round(s.metrics_data.spend * 100) / 100,
    })), [filtered]);

  const engagementByPlatform = useMemo(() =>
    filtered.filter(s => {
      const eng = (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0);
      return eng > 0;
    }).map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      value: (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0),
    })), [filtered]);

  const impressionsByPlatform = useMemo(() =>
    filtered.filter(s => s.metrics_data.impressions > 0).map(s => ({
      name: PLATFORM_LABELS[s.platform] || s.platform,
      impressions: s.metrics_data.impressions,
      clicks: s.metrics_data.clicks || 0,
    })), [filtered]);

  // Trend data for line chart
  const trendChartData = useMemo(() => {
    const monthMap = new Map<string, { spend: number; impressions: number; clicks: number; engagement: number }>();
    const relevantTrend = selectedPlatform === 'all' ? trendData : trendData.filter(s => s.platform === selectedPlatform);

    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { spend: 0, impressions: 0, clicks: 0, engagement: 0 };
      existing.spend += s.metrics_data.spend || 0;
      existing.impressions += s.metrics_data.impressions || 0;
      existing.clicks += s.metrics_data.clicks || 0;
      existing.engagement += (s.metrics_data.engagement || 0) + (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0);
      monthMap.set(key, existing);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, data]) => {
        const [y, m] = key.split('-');
        return { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, ...data };
      });
  }, [trendData, selectedPlatform]);

  // Last synced timestamp
  const lastSyncedAt = useMemo(() => {
    const syncDates = connections
      .filter(c => c.last_sync_at)
      .map(c => new Date(c.last_sync_at!).getTime());
    if (syncDates.length === 0) return null;
    return new Date(Math.max(...syncDates));
  }, [connections]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasData = snapshots.length > 0;
  const hasFilteredData = filtered.length > 0;
  const allZeros = hasFilteredData && kpis.every(k => k.value === 0);

  return (
    <div className="space-y-8">
      {/* Header with Platform & Time controls */}
      <DashboardHeader
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        availablePlatforms={availablePlatforms}
      />

      {/* Last synced indicator */}
      {lastSyncedAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Last synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
        </div>
      )}

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No performance data available</p>
            <p className="text-sm text-muted-foreground/70">
              Sync platform data for this period to see your dashboard.
            </p>
          </CardContent>
        </Card>
      ) : !hasFilteredData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <PieChartIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No data for this platform</p>
            <p className="text-sm text-muted-foreground/70">
              Try selecting "All Platforms" or sync data for this platform.
            </p>
          </CardContent>
        </Card>
      ) : allZeros ? (
        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <p className="text-muted-foreground font-medium">No activity recorded for this period</p>
            <p className="text-sm text-muted-foreground/70">
              Try selecting a different period or sync historical data to find periods with activity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis.map(kpi => {
              const Icon = kpi.icon;
              const isPositive = kpi.change !== undefined
                ? kpi.isCost ? kpi.change < 0 : kpi.change > 0
                : undefined;

              return (
                <Card key={kpi.label} className="relative overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                    </div>
                    <p className="text-2xl font-display font-bold">{kpi.formatted}</p>
                    {kpi.change !== undefined && (
                      <div className={cn(
                        'flex items-center gap-1 mt-2 text-xs font-medium',
                        isPositive === true ? 'text-accent' :
                        isPositive === false ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {kpi.change > 0 ? <TrendingUp className="h-3 w-3" /> :
                         kpi.change < 0 ? <TrendingDown className="h-3 w-3" /> :
                         <Minus className="h-3 w-3" />}
                        <span>{kpi.change > 0 ? '+' : ''}{kpi.change.toFixed(1)}% vs prev</span>
                      </div>
                    )}
                    {kpi.value === 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-1 italic">Data unavailable</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Spend Distribution */}
            {spendByPlatform.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">💰 Spend Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={spendByPlatform}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {spendByPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => `${currSymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">💰 Spend Distribution</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center h-[260px]">
                  <p className="text-sm text-muted-foreground italic">No spend data available for this period</p>
                </CardContent>
              </Card>
            )}

            {/* Engagement Breakdown */}
            {engagementByPlatform.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display">💬 Engagement Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={engagementByPlatform}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {engagementByPlatform.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-display">💬 Engagement Breakdown</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-center h-[260px]">
                  <p className="text-sm text-muted-foreground italic">No engagement data available for this period</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Impressions & Clicks Bar Chart */}
          {impressionsByPlatform.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">📊 Impressions & Clicks by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={impressionsByPlatform} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Bar dataKey="impressions" name="Impressions" fill={PIE_COLORS[0]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="clicks" name="Clicks" fill={PIE_COLORS[1]} radius={[6, 6, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Trend Line Chart */}
          {trendChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">📈 Performance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="impressions" name="Impressions" stroke={PIE_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="clicks" name="Clicks" stroke={PIE_COLORS[1]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="engagement" name="Engagement" stroke={PIE_COLORS[2]} strokeWidth={2} dot={{ r: 4 }} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Per-Platform Metrics */}
          <div className="space-y-5">
            <h3 className="text-lg font-display">Platform Details</h3>
            {filtered.length > 0 ? (
              filtered
                .filter(snapshot => {
                  // Hide platforms disabled in config
                  const config = platformConfigs.get(snapshot.platform);
                  if (config && !config.is_enabled) return false;
                  // Skip platforms where all displayable metrics are zero
                  const isOrganic = ORGANIC_PLATFORMS.has(snapshot.platform);
                  const enabledMetrics = config?.enabled_metrics;
                  const hasVisibleNonZero = Object.entries(snapshot.metrics_data).some(
                    ([key, val]) =>
                      typeof val === 'number' && val > 0 &&
                      !HIDDEN_METRICS.has(key) &&
                      !(isOrganic && AD_METRICS.has(key)) &&
                      (enabledMetrics && enabledMetrics.length > 0 ? enabledMetrics.includes(key) : true)
                  );
                  return hasVisibleNonZero;
                })
                .map(snapshot => {
                  const prevSnapshot = filteredPrev.find(s => s.platform === snapshot.platform);
                  const config = platformConfigs.get(snapshot.platform);
                  const conn = connections.find(c => c.platform === snapshot.platform);
                  return (
                    <PlatformMetricsCard
                      key={snapshot.platform}
                      platform={snapshot.platform}
                      metrics={snapshot.metrics_data}
                      prevMetrics={prevSnapshot?.metrics_data}
                      currencyCode={currencyCode}
                      enabledMetrics={config?.enabled_metrics && config.enabled_metrics.length > 0 ? config.enabled_metrics : undefined}
                      syncStatus={conn?.last_sync_status}
                      lastError={conn?.last_error}
                    />
                  );
                })
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground italic">No platform data available for this selection</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* AI Analysis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Performance Analysis
          </CardTitle>
          <Button
            size="sm"
            variant={aiAnalysis ? 'outline' : 'default'}
            onClick={handleAnalyse}
            disabled={isAnalysing}
            className="gap-2"
          >
            {isAnalysing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {aiAnalysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </Button>
        </CardHeader>
        <CardContent>
          {aiAnalysis ? (
            <div className="prose prose-sm max-w-none text-foreground">
              {aiAnalysis.split('\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed mb-3">{para}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Click "Generate Analysis" to get an AI-powered summary of this client's performance.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Demographics Placeholder */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">👥 Audience & Demographics</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Audience insights coming soon</p>
          <p className="text-xs text-muted-foreground/60">Demographics, age groups, and geographic data will appear here once available.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboard;
