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
}

export const useClientDashboard = ({ clientId, currencyCode, portalToken }: UseClientDashboardParams) => {
  const isPortal = !!portalToken;
  const currSymbol = getCurrencySymbol(currencyCode);
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

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
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiAnalysisDate, setAiAnalysisDate] = useState<Date | null>(null);
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
    let query = supabase.from("monthly_snapshots").select("platform, metrics_data, top_content, report_month, report_year").eq("client_id", clientId);
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
      setAiAnalysis(data.analysis || "No analysis available.");
      setAiAnalysisDate(new Date());
      setLastAnalysisTime(Date.now());
      setCooldownRemaining(60);
      setAnalysisDialogOpen(true);
    } catch (e) { console.error("Analysis error:", e); toast.error("Failed to generate AI analysis"); }
    finally { setIsAnalysing(false); }
  };

  // ─── Computed Data ─────────────────────────────────────────
  const filtered = useMemo(() => (selectedPlatform === "all" ? snapshots : snapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [snapshots, selectedPlatform]);
  const filteredPrev = useMemo(() => (selectedPlatform === "all" ? prevSnapshots : prevSnapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [prevSnapshots, selectedPlatform]);

  const kpis = useMemo(() => {
    const totalSpend = filtered.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const totalReach = filtered.reduce((sum, s) => { const m = s.metrics_data; if (s.platform === 'facebook') return sum + (m.views || 0); return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const totalClicks = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0); }, 0);
    const totalEngagement = filtered.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const totalFollowers = Math.max(...filtered.map(s => s.metrics_data.total_followers || 0), 0);
    const totalSessions = filtered.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const totalVideoViews = filtered.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
    const totalConversions = filtered.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);
    const totalPageViews = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0); }, 0);
    const totalWebsiteClicks = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0); }, 0);

    const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const prevReach = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; if (s.platform === 'facebook') return sum + (m.views || 0); return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const prevClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0); }, 0);
    const prevEngagement = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const prevSessions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const prevVideoViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
    const prevConversions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);
    const prevPageViews = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0); }, 0);
    const prevWebsiteClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0); }, 0);

    const cc = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / prev) * 100 : undefined);
    const platformsFor = (metricFn: (m: Record<string, number>) => number): PlatformType[] =>
      [...new Set(filtered.filter(s => metricFn(s.metrics_data) > 0).map(s => s.platform))];

    const spendPlatforms = platformsFor(m => m.spend || 0);
    const reachPlatforms = [...new Set(filtered.filter(s => { const m = s.metrics_data; if (s.platform === 'facebook') return (m.views || 0) > 0; return (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0) > 0; }).map(s => s.platform))];
    const clicksPlatforms = platformsFor(m => (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0));
    const engagementPlatforms = platformsFor(m => m.engagement ? m.engagement : (m.likes || 0) + (m.reactions || 0) + (m.comments || 0) + (m.shares || 0));
    const followerPlatforms = platformsFor(m => m.total_followers || 0);
    const sessionsPlatforms = platformsFor(m => m.sessions || 0);
    const videoViewsPlatforms = platformsFor(m => m.video_views || 0);
    const conversionsPlatforms = platformsFor(m => m.conversions || 0);
    const pageViewsPlatforms = platformsFor(m => (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0));
    const websiteClicksPlatforms = platformsFor(m => (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0));

    const totalSearchImpressions = filtered.reduce((sum, s) => sum + (s.metrics_data.search_impressions || 0), 0);
    const totalSearchClicks = filtered.reduce((sum, s) => sum + (s.metrics_data.search_clicks || 0), 0);
    const gscSnapshots = filtered.filter(s => s.platform === 'google_search_console' && s.metrics_data.search_ctr !== undefined);
    const totalSearchCtr = gscSnapshots.length > 0 && totalSearchImpressions > 0 ? (totalSearchClicks / totalSearchImpressions) * 100 : 0;
    const gscPositionSnapshots = filtered.filter(s => s.platform === 'google_search_console' && s.metrics_data.search_position > 0);
    const avgSearchPosition = gscPositionSnapshots.length > 0 ? gscPositionSnapshots.reduce((sum, s) => sum + s.metrics_data.search_position, 0) / gscPositionSnapshots.length : 0;
    const prevSearchImpressions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.search_impressions || 0), 0);
    const prevSearchClicks = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.search_clicks || 0), 0);
    const prevGscSnapshots = filteredPrev.filter(s => s.platform === 'google_search_console' && s.metrics_data.search_ctr !== undefined);
    const prevSearchCtr = prevGscSnapshots.length > 0 && prevSearchImpressions > 0 ? (prevSearchClicks / prevSearchImpressions) * 100 : 0;
    const prevGscPositionSnapshots = filteredPrev.filter(s => s.platform === 'google_search_console' && s.metrics_data.search_position > 0);
    const prevAvgSearchPosition = prevGscPositionSnapshots.length > 0 ? prevGscPositionSnapshots.reduce((sum, s) => sum + s.metrics_data.search_position, 0) / prevGscPositionSnapshots.length : 0;
    const searchImpressionsPlatforms = platformsFor(m => m.search_impressions || 0);
    const searchClicksPlatforms = platformsFor(m => m.search_clicks || 0);
    const searchCtrPlatforms = platformsFor(m => m.search_ctr !== undefined ? 1 : 0);
    const searchPositionPlatforms = platformsFor(m => m.search_position > 0 ? 1 : 0);

    return [
      ...((selectedPlatform === 'all' || filterIncludesPlatform(selectedPlatform, 'meta_ads') || filterIncludesPlatform(selectedPlatform, 'google_ads')) && totalSpend > 0 ? [{ label: "Total Spend", value: totalSpend, change: cc(totalSpend, prevSpend), icon: Banknote, isCost: true, metricKey: "spend", platforms: spendPlatforms }] : []),
      ...(totalVideoViews > 0 ? [{ label: "Video Views", value: totalVideoViews, change: cc(totalVideoViews, prevVideoViews), icon: Eye, metricKey: "video_views", platforms: videoViewsPlatforms }] : []),
      ...(totalReach > 0 ? [{ label: "Reach", value: totalReach, change: cc(totalReach, prevReach), icon: Eye, metricKey: "reach", platforms: reachPlatforms }] : []),
      ...(totalClicks > 0 ? [{ label: "Clicks", value: totalClicks, change: cc(totalClicks, prevClicks), icon: MousePointerClick, metricKey: "clicks", platforms: clicksPlatforms }] : []),
      ...(totalEngagement > 0 ? [{ label: "Engagement", value: totalEngagement, change: cc(totalEngagement, prevEngagement), icon: MessageCircle, metricKey: "engagement", platforms: engagementPlatforms }] : []),
      ...(totalFollowers > 0 ? [{ label: "Followers", value: totalFollowers, change: undefined as number | undefined, icon: Users, metricKey: "total_followers", platforms: followerPlatforms }] : []),
      ...(totalSessions > 0 ? [{ label: "Sessions", value: totalSessions, change: cc(totalSessions, prevSessions), icon: Activity, metricKey: "sessions", platforms: sessionsPlatforms }] : []),
      ...(totalSearchImpressions > 0 ? [{ label: "Search Impressions", value: totalSearchImpressions, change: cc(totalSearchImpressions, prevSearchImpressions), icon: Search, metricKey: "search_impressions", platforms: searchImpressionsPlatforms }] : []),
      ...(totalSearchClicks > 0 ? [{ label: "Search Clicks", value: totalSearchClicks, change: cc(totalSearchClicks, prevSearchClicks), icon: MousePointerClick, metricKey: "search_clicks", platforms: searchClicksPlatforms }] : []),
      ...(totalSearchCtr > 0 ? [{ label: "Search CTR", value: totalSearchCtr, change: cc(totalSearchCtr, prevSearchCtr), icon: Crosshair, metricKey: "search_ctr", platforms: searchCtrPlatforms, isPercentage: true }] : []),
      ...(avgSearchPosition > 0 ? [{ label: "Avg. Position", value: avgSearchPosition, change: cc(avgSearchPosition, prevAvgSearchPosition), icon: Hash, metricKey: "search_position", platforms: searchPositionPlatforms, isDecimal: true }] : []),
      ...(totalConversions > 0 ? [{ label: "Conversions", value: totalConversions, change: cc(totalConversions, prevConversions), icon: Target, metricKey: "conversions", platforms: conversionsPlatforms }] : []),
      ...(totalPageViews > 0 ? [{ label: "Page Views", value: totalPageViews, change: cc(totalPageViews, prevPageViews), icon: FileText, metricKey: "page_views", platforms: pageViewsPlatforms }] : []),
      ...(totalWebsiteClicks > 0 ? [{ label: "Website Clicks", value: totalWebsiteClicks, change: cc(totalWebsiteClicks, prevWebsiteClicks), icon: Link, metricKey: "website_clicks", platforms: websiteClicksPlatforms }] : []),
    ] as KpiItem[];
  }, [filtered, filteredPrev, selectedPlatform]);

  const sparklineMap = useMemo(() => {
    const map: Record<string, Array<{ v: number; name: string }>> = {};
    const relevantTrend = selectedPlatform === "all" ? trendData : trendData.filter(s => matchesPlatformFilter(selectedPlatform, s.platform));
    const monthMap = new Map<string, Record<string, number>>();
    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || {};
      existing.spend = (existing.spend || 0) + (s.metrics_data.spend || 0);
      existing.reach = (existing.reach || 0) + (s.platform === 'facebook' ? (s.metrics_data.views || 0) : (s.metrics_data.reach || s.metrics_data.impressions || s.metrics_data.search_impressions || s.metrics_data.views || s.metrics_data.gbp_views || 0));
      existing.clicks = (existing.clicks || 0) + (s.metrics_data.clicks || 0) + (s.metrics_data.search_clicks || 0) + (s.metrics_data.gbp_website_clicks || 0);
      existing.engagement = (existing.engagement || 0) + (s.metrics_data.engagement ? s.metrics_data.engagement : (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0));
      existing.total_followers = Math.max(existing.total_followers || 0, s.metrics_data.total_followers || 0);
      existing.video_views = (existing.video_views || 0) + (s.metrics_data.video_views || 0);
      existing.sessions = (existing.sessions || 0) + (s.metrics_data.sessions || 0);
      monthMap.set(key, existing);
    }
    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || {};
      existing.search_impressions = (existing.search_impressions || 0) + (s.metrics_data.search_impressions || 0);
      existing.search_clicks = (existing.search_clicks || 0) + (s.metrics_data.search_clicks || 0);
      monthMap.set(key, existing);
    }
    const sortedFinal = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    for (const metricKey of ["spend", "reach", "clicks", "engagement", "total_followers", "video_views", "sessions", "search_impressions", "search_clicks"]) {
      map[metricKey] = sortedFinal.map(([key, data]) => { const [y, m] = key.split("-"); return { v: data[metricKey] || 0, name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}` }; });
    }
    return map;
  }, [trendData, selectedPlatform]);

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

  return {
    selectedPlatform, setSelectedPlatform,
    selectedPeriod, setSelectedPeriod,
    isLoading, isPortal, currSymbol,
    availablePlatforms, connections, platformConfigs,
    snapshots, filtered, filteredPrev, trendData,
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
