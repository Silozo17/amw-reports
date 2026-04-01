import { useEffect, useState, useCallback, useMemo } from "react";
import { subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { PLATFORM_LABELS, getCurrencySymbol, HIDDEN_METRICS } from "@/types/database";
import type { PlatformType, JobStatus } from "@/types/database";
import { toast } from "sonner";
import type { SelectedPeriod, PlatformFilter } from "@/components/clients/DashboardHeader";
import { computeKpis, computeSparklines } from "@/lib/dashboardCalcs";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TopContentItem {
  page_name?: string;
  message?: string;
  caption?: string;
  created_time?: string;
  timestamp?: string;
  full_picture?: string | null;
  permalink_url?: string | null;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  clicks?: number;
  total_engagement?: number;
  media_type?: string;
  video_views?: number;
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
}

export interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  top_content?: TopContentItem[];
  raw_data?: Record<string, unknown>;
  report_month: number;
  report_year: number;
}

export interface ConnectionData {
  id: string;
  platform: PlatformType;
  last_sync_at: string | null;
  last_sync_status: JobStatus | null;
  last_error: string | null;
}

export interface PlatformConfigData {
  platform: PlatformType;
  is_enabled: boolean;
  enabled_metrics: string[];
}

export interface KpiItem {
  label: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  isCost?: boolean;
  isPercentage?: boolean;
  isDecimal?: boolean;
  metricKey: string;
  platforms: PlatformType[];
}

export interface ChartDataEntry {
  name: string;
  _key?: string;
  [key: string]: number | string | undefined;
}

const matchesPlatformFilter = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

const filterIncludesPlatform = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

interface UseClientDashboardParams {
  clientId: string;
  currencyCode: string;
  portalToken?: string;
  initialMonth?: number;
  initialYear?: number;
}

export const useClientDashboard = ({ clientId, currencyCode, portalToken, initialMonth, initialYear }: UseClientDashboardParams) => {
  const isPortal = !!portalToken;
  const currSymbol = getCurrencySymbol(currencyCode);
  const now = new Date();
  const defaultMonth = initialMonth ?? (now.getMonth() + 1);
  const defaultYear = initialYear ?? now.getFullYear();

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({
    type: "monthly", month: defaultMonth, year: defaultYear,
  });

  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<SnapshotData[]>([]);
  const [trendData, setTrendData] = useState<SnapshotData[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<PlatformType[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [platformConfigs, setPlatformConfigs] = useState<Map<string, PlatformConfigData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [analysisMap, setAnalysisMap] = useState<Map<string, { text: string; date: Date }>>(new Map());
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [allPosts, setAllPosts] = useState<(TopContentItem & { platform: PlatformType })[]>([]);

  useEffect(() => { setHasAutoDetected(false); }, [clientId]);

  // ─── Aggregation helpers ───────────────────────────────────
  const aggregateMultiMonth = (snaps: SnapshotData[], month: number, year: number): SnapshotData[] => {
    const grouped = new Map<PlatformType, Record<string, number>>();
    for (const s of snaps) {
      const existing = grouped.get(s.platform) || {};
      for (const [k, v] of Object.entries(s.metrics_data)) {
        if (typeof v === "number") {
          if (k === "total_followers") existing[k] = Math.max(existing[k] || 0, v);
          else existing[k] = (existing[k] || 0) + v;
        }
      }
      grouped.set(s.platform, existing);
    }
    return Array.from(grouped.entries()).map(([platform, metrics]) => {
      const a = { ...metrics };
      if (a.spend && a.clicks) a.cpc = a.spend / a.clicks;
      if (a.spend && a.conversions) a.cost_per_conversion = a.spend / a.conversions;
      if (a.spend && a.leads) a.cost_per_lead = a.spend / a.leads;
      if (a.clicks && a.impressions) a.ctr = (a.clicks / a.impressions) * 100;
      if (a.engagement && a.impressions) a.engagement_rate = (a.engagement / a.impressions) * 100;
      return { platform, metrics_data: a, report_month: month, report_year: year };
    });
  };

  const collectPosts = (rawSnapshots: SnapshotData[]): (TopContentItem & { platform: PlatformType })[] => {
    const collected: (TopContentItem & { platform: PlatformType })[] = [];
    for (const s of rawSnapshots) {
      if (Array.isArray(s.top_content) && s.top_content.length > 0) {
        for (const post of s.top_content) collected.push({ ...post, platform: s.platform });
      }
    }
    collected.sort((a, b) => (b.total_engagement ?? 0) - (a.total_engagement ?? 0));
    return collected;
  };

  const autoDetectPeriod = (currentSnapshots: SnapshotData[], allTrendData: SnapshotData[]) => {
    const hasRealData = currentSnapshots.some((snapshot) =>
      Object.entries(snapshot.metrics_data).some(([key, v]) => typeof v === "number" && v > 0 && !HIDDEN_METRICS.has(key)),
    );
    if (!hasAutoDetected && !hasRealData && allTrendData.length > 0) {
      const monthsWithData = new Map<string, { m: number; y: number; total: number }>();
      for (const s of allTrendData) {
        const key = `${s.report_year}-${s.report_month}`;
        const existing = monthsWithData.get(key) || { m: s.report_month, y: s.report_year, total: 0 };
        existing.total += Object.entries(s.metrics_data).filter(([k]) => !HIDDEN_METRICS.has(k)).reduce((sum, [, v]) => sum + (typeof v === "number" ? Math.abs(v) : 0), 0);
        monthsWithData.set(key, existing);
      }
      const sorted = Array.from(monthsWithData.values()).filter(d => d.total > 0).sort((a, b) => (a.y !== b.y ? b.y - a.y : b.m - a.m));
      if (sorted.length > 0) setSelectedPeriod(prev => ({ ...prev, month: sorted[0].m, year: sorted[0].y }));
      setHasAutoDetected(true);
    } else if (!hasAutoDetected) { setHasAutoDetected(true); }
  };

  // ─── Data Fetching ─────────────────────────────────────────
  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    const { month, year, type, startDate, endDate } = selectedPeriod;

    if (isPortal) {
      const { data, error: fnErr } = await supabase.functions.invoke("portal-data", {
        body: { token: portalToken, month, year, type, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() },
      });
      if (fnErr || data?.error) { console.error("Portal data error:", fnErr || data?.error); setIsLoading(false); return; }

      const configMap = new Map<string, PlatformConfigData>();
      for (const c of (data.configs ?? []) as PlatformConfigData[]) configMap.set(c.platform, c);
      setPlatformConfigs(configMap);
      setConnections((data.connections ?? []) as ConnectionData[]);

      let currentSnapshots = (data.snapshots ?? []) as SnapshotData[];
      const isMultiMonth = type !== "monthly" && type !== "weekly";
      if (isMultiMonth && currentSnapshots.length > 0) currentSnapshots = aggregateMultiMonth(currentSnapshots, month, year);

      setAllPosts(collectPosts(data.snapshots ?? []));
      setSnapshots(currentSnapshots);
      setPrevSnapshots((data.prevSnapshots ?? []) as SnapshotData[]);
      setTrendData((data.trendData ?? []) as SnapshotData[]);
      const platforms = (data.connections ?? []).map((c: ConnectionData) => c.platform as PlatformType).filter((v: PlatformType, i: number, a: PlatformType[]) => a.indexOf(v) === i);
      setAvailablePlatforms(platforms);
      autoDetectPeriod(currentSnapshots, data.trendData ?? []);
      setIsLoading(false);
      return;
    }

    // Authenticated mode
    let query = supabase.from("monthly_snapshots").select("platform, metrics_data, top_content, raw_data, report_month, report_year").eq("client_id", clientId);
    let isMultiMonth = false;

    if (type === "quarterly") {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      query = query.in("report_month", [qStart, qStart + 1, qStart + 2]).eq("report_year", year);
      isMultiMonth = true;
    } else if (type === "ytd") {
      const currentMonth = new Date().getMonth() + 1;
      query = query.in("report_month", Array.from({ length: currentMonth }, (_, i) => i + 1)).eq("report_year", year);
      isMultiMonth = true;
    } else if (type === "last_year") {
      query = query.eq("report_year", year); isMultiMonth = true;
    } else if (type === "maximum") {
      isMultiMonth = true;
    } else if (type === "custom" && startDate && endDate) {
      const sMonth = startDate.getMonth() + 1; const sYear = startDate.getFullYear();
      const eMonth = endDate.getMonth() + 1; const eYear = endDate.getFullYear();
      if (sYear === eYear) {
        query = query.in("report_month", Array.from({ length: eMonth - sMonth + 1 }, (_, i) => sMonth + i)).eq("report_year", sYear);
      } else {
        query = query.or(`and(report_year.eq.${sYear},report_month.gte.${sMonth}),and(report_year.gt.${sYear},report_year.lt.${eYear}),and(report_year.eq.${eYear},report_month.lte.${eMonth})`);
      }
      isMultiMonth = true;
    } else {
      query = query.eq("report_month", month).eq("report_year", year);
    }

    let prevMonth = month; let prevYear = year;
    const showComparison = type === "weekly" || type === "monthly" || type === "quarterly";
    if (type === "quarterly") {
      const d = subMonths(new Date(year, month - 1), 3); prevMonth = d.getMonth() + 1; prevYear = d.getFullYear();
    } else { prevMonth = month === 1 ? 12 : month - 1; prevYear = month === 1 ? year - 1 : year; }

    const sixMonthsAgo = new Date(year, month - 1); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startMonth = sixMonthsAgo.getMonth() + 1; const startYr = sixMonthsAgo.getFullYear();

    const [currentRes, prevRes, trendRes, connectionsRes, configRes] = await Promise.all([
      query,
      showComparison
        ? supabase.from("monthly_snapshots").select("platform, metrics_data, report_month, report_year").eq("client_id", clientId).eq("report_month", prevMonth).eq("report_year", prevYear)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("monthly_snapshots").select("platform, metrics_data, report_month, report_year").eq("client_id", clientId)
        .or(`report_year.gt.${startYr},and(report_year.eq.${startYr},report_month.gte.${startMonth})`)
        .order("report_year", { ascending: true }).order("report_month", { ascending: true }),
      supabase.from("platform_connections").select("id, platform, last_sync_at, last_sync_status, last_error").eq("client_id", clientId).eq("is_connected", true),
      supabase.from("client_platform_config").select("platform, is_enabled, enabled_metrics").eq("client_id", clientId),
    ]);

    setConnections((connectionsRes.data ?? []) as ConnectionData[]);
    const configMap = new Map<string, PlatformConfigData>();
    for (const c of (configRes.data ?? []) as PlatformConfigData[]) configMap.set(c.platform, c);
    setPlatformConfigs(configMap);

    let currentSnapshots = (currentRes.data ?? []) as SnapshotData[];
    if (isMultiMonth && currentSnapshots.length > 0) currentSnapshots = aggregateMultiMonth(currentSnapshots, month, year);

    setAllPosts(collectPosts((currentRes.data ?? []) as SnapshotData[]));
    setSnapshots(currentSnapshots);
    setPrevSnapshots((prevRes.data ?? []) as SnapshotData[]);
    setTrendData((trendRes.data ?? []) as SnapshotData[]);
    const platforms = [...new Set((connectionsRes.data ?? []).map((c: ConnectionData) => c.platform as PlatformType))];
    setAvailablePlatforms(platforms);
    autoDetectPeriod(currentSnapshots, (trendRes.data ?? []) as SnapshotData[]);
    setIsLoading(false);
  }, [clientId, selectedPeriod, hasAutoDetected, isPortal, portalToken]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(Math.max(0, Math.ceil((lastAnalysisTime + 60000 - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining, lastAnalysisTime]);

  const handleAnalyse = async () => {
    const n = Date.now();
    if (n - lastAnalysisTime < 60000) { toast.error(`Please wait ${Math.ceil((lastAnalysisTime + 60000 - n) / 1000)}s`); return; }
    setIsAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client", { body: { client_id: clientId, month: selectedPeriod.month, year: selectedPeriod.year } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const pKey = `${selectedPeriod.type}-${selectedPeriod.month}-${selectedPeriod.year}`;
      setAnalysisMap(prev => new Map(prev).set(pKey, { text: data.analysis || "No analysis available.", date: new Date() }));
      setLastAnalysisTime(Date.now());
      setCooldownRemaining(60);
      setAnalysisDialogOpen(true);
    } catch (e) { console.error("Analysis error:", e); toast.error("Failed to generate AI analysis"); }
    finally { setIsAnalysing(false); }
  };

  // ─── Computed Data ─────────────────────────────────────────
  const filtered = useMemo(() => (selectedPlatform === "all" ? snapshots : snapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [snapshots, selectedPlatform]);
  const filteredPrev = useMemo(() => (selectedPlatform === "all" ? prevSnapshots : prevSnapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [prevSnapshots, selectedPlatform]);

  const kpis = useMemo(() => computeKpis(filtered, filteredPrev, selectedPlatform), [filtered, filteredPrev, selectedPlatform]);

  const sparklineMap = useMemo(() => computeSparklines(trendData, selectedPlatform, matchesPlatformFilter), [trendData, selectedPlatform]);

  const spendByPlatform = useMemo(() => filtered.filter(s => s.metrics_data.spend > 0).map(s => ({ name: PLATFORM_LABELS[s.platform] || s.platform, value: Math.round(s.metrics_data.spend * 100) / 100 })), [filtered]);
  const totalSpend = useMemo(() => spendByPlatform.reduce((s, d) => s + d.value, 0), [spendByPlatform]);

  const engagementStackedData = useMemo(() => filtered.filter(s => (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0) + (s.metrics_data.engagement || 0) > 0).map(s => ({ name: PLATFORM_LABELS[s.platform] || s.platform, likes: s.metrics_data.likes || 0, comments: s.metrics_data.comments || 0, shares: s.metrics_data.shares || 0, saves: s.metrics_data.saves || 0 })), [filtered]);

  const impressionsByPlatform = useMemo(() => filtered.filter(s => s.metrics_data.impressions > 0).map(s => ({ name: PLATFORM_LABELS[s.platform] || s.platform, impressions: s.metrics_data.impressions, clicks: s.metrics_data.clicks || 0 })), [filtered]);

  const trendChartData = useMemo(() => {
    const monthMap = new Map<string, { spend: number; impressions: number; clicks: number; engagement: number; video_views: number; reach: number }>();
    const relevantTrend = selectedPlatform === "all" ? trendData : trendData.filter(s => matchesPlatformFilter(selectedPlatform, s.platform));
    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { spend: 0, impressions: 0, clicks: 0, engagement: 0, video_views: 0, reach: 0 };
      existing.spend += s.metrics_data.spend || 0;
      existing.impressions += s.metrics_data.impressions || 0;
      existing.clicks += s.metrics_data.clicks || 0;
      existing.video_views += s.metrics_data.video_views || 0;
      existing.reach += s.metrics_data.reach || 0;
      existing.engagement += s.metrics_data.engagement ? s.metrics_data.engagement : (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0);
      monthMap.set(key, existing);
    }
    return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, data]) => { const [y, m] = key.split("-"); return { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, ...data }; });
  }, [trendData, selectedPlatform]);

  const platformTrendMap = useMemo(() => {
    const map = new Map<PlatformType, ChartDataEntry[]>();
    for (const s of trendData) {
      const existing = map.get(s.platform) || [];
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      let entry = existing.find(e => e._key === key);
      if (!entry) {
        const [y, m] = key.split("-");
        entry = { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, _key: key };
        existing.push(entry);
      }
      for (const [mk, mv] of Object.entries(s.metrics_data)) {
        if (typeof mv === 'number') (entry)[mk] = ((entry)[mk] as number || 0) + mv;
      }
      map.set(s.platform, existing);
    }
    for (const [platform, data] of map) {
      data.sort((a, b) => (a._key as string).localeCompare(b._key as string));
      map.set(platform, data.slice(-6));
    }
    return map;
  }, [trendData]);

  const gscTrendData = useMemo(() => {
    const gscSnapshots = trendData.filter(s => s.platform === 'google_search_console');
    if (gscSnapshots.length === 0) return [];
    const monthMap = new Map<string, { search_impressions: number; search_clicks: number; search_ctr: number; search_position: number; count: number }>();
    for (const s of gscSnapshots) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { search_impressions: 0, search_clicks: 0, search_ctr: 0, search_position: 0, count: 0 };
      existing.search_impressions += s.metrics_data.search_impressions || 0;
      existing.search_clicks += s.metrics_data.search_clicks || 0;
      existing.search_ctr += s.metrics_data.search_ctr || 0;
      existing.search_position += s.metrics_data.search_position || 0;
      existing.count += 1;
      monthMap.set(key, existing);
    }
    return Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, data]) => {
      const [y, m] = key.split("-");
      return { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, search_impressions: data.search_impressions, search_clicks: data.search_clicks, search_ctr: data.count > 0 ? data.search_ctr / data.count : 0, search_position: data.count > 0 ? data.search_position / data.count : 0 };
    });
  }, [trendData]);

  const lastSyncedAt = useMemo(() => {
    const syncDates = connections.filter(c => c.last_sync_at).map(c => new Date(c.last_sync_at!).getTime());
    return syncDates.length === 0 ? null : new Date(Math.max(...syncDates));
  }, [connections]);

  const hasData = snapshots.length > 0;
  const hasFilteredData = filtered.length > 0;
  const allZeros = hasFilteredData && kpis.every(k => k.value === 0);

  const periodKey = `${selectedPeriod.type}-${selectedPeriod.month}-${selectedPeriod.year}`;
  const currentAnalysis = analysisMap.get(periodKey);
  const aiAnalysis = currentAnalysis?.text ?? "";
  const aiAnalysisDate = currentAnalysis?.date ?? null;

  return {
    selectedPlatform, setSelectedPlatform,
    selectedPeriod, setSelectedPeriod,
    isLoading, isPortal, currSymbol,
    availablePlatforms, connections, platformConfigs,
    snapshots, prevSnapshots, filtered, filteredPrev, trendData,
    kpis, sparklineMap,
    spendByPlatform, totalSpend,
    engagementStackedData, impressionsByPlatform,
    trendChartData, platformTrendMap, gscTrendData,
    allPosts, lastSyncedAt,
    hasData, hasFilteredData, allZeros,
    aiAnalysis, aiAnalysisDate, analysisDialogOpen, setAnalysisDialogOpen,
    isAnalysing, cooldownRemaining, handleAnalyse,
    matchesPlatformFilter,
  };
};
