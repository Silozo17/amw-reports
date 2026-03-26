import { useEffect, useState, useCallback, useMemo } from "react";
import { subMonths, formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Banknote, Eye, MousePointerClick, MessageCircle, Users,
  BarChart3, PieChartIcon, AlertCircle, Clock, Loader2, Activity,
  Target, FileText, Link,
} from "lucide-react";
import { PLATFORM_LOGOS, PLATFORM_LABELS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from "@/types/database";
import { METRIC_EXPLANATIONS } from "@/types/metrics";
import type { PlatformType, JobStatus } from "@/types/database";
import { toast } from "sonner";
import DashboardHeader, { type SelectedPeriod, type PlatformFilter } from "./DashboardHeader";
import HeroKPIs from "./dashboard/HeroKPIs";
import PlatformSection from "./dashboard/PlatformSection";
import PerformanceOverview from "./dashboard/PerformanceOverview";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
  currencyCode?: string;
}

interface TopContentItem {
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

interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  top_content?: TopContentItem[];
  report_month: number;
  report_year: number;
}

interface ConnectionData {
  id: string;
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

interface KpiItem {
  label: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  isCost?: boolean;
  metricKey: string;
  platforms: PlatformType[];
}

const matchesPlatformFilter = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

const filterIncludesPlatform = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

// ─── Dashboard Skeleton ────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5"><Skeleton className="h-[220px] w-full rounded" /></CardContent>
        </Card>
      ))}
    </div>
    {Array.from({ length: 2 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-16 rounded" />)}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Main Dashboard ────────────────────────────────────────────
const ClientDashboard = ({ clientId, clientName, currencyCode = "GBP" }: ClientDashboardProps) => {
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

  // ─── Data Fetching ───────────────────────────────────────────
  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    const { month, year, type, startDate, endDate } = selectedPeriod;

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
    if (isMultiMonth && currentSnapshots.length > 0) {
      const grouped = new Map<PlatformType, Record<string, number>>();
      for (const s of currentSnapshots) {
        const existing = grouped.get(s.platform) || {};
        for (const [k, v] of Object.entries(s.metrics_data)) {
          if (typeof v === "number") {
            if (k === "total_followers") existing[k] = Math.max(existing[k] || 0, v);
            else existing[k] = (existing[k] || 0) + v;
          }
        }
        grouped.set(s.platform, existing);
      }
      currentSnapshots = Array.from(grouped.entries()).map(([platform, metrics]) => {
        const a = { ...metrics };
        if (a.spend && a.clicks) a.cpc = a.spend / a.clicks;
        if (a.spend && a.conversions) a.cost_per_conversion = a.spend / a.conversions;
        if (a.clicks && a.impressions) a.ctr = (a.clicks / a.impressions) * 100;
        if (a.engagement && a.impressions) a.engagement_rate = (a.engagement / a.impressions) * 100;
        return { platform, metrics_data: a, report_month: month, report_year: year };
      });
    }

    const rawSnapshots = (currentRes.data ?? []) as SnapshotData[];
    const collectedPosts: (TopContentItem & { platform: PlatformType })[] = [];
    for (const s of rawSnapshots) {
      if (Array.isArray(s.top_content) && s.top_content.length > 0) {
        for (const post of s.top_content) collectedPosts.push({ ...post, platform: s.platform });
      }
    }
    collectedPosts.sort((a, b) => (b.total_engagement ?? 0) - (a.total_engagement ?? 0));
    setAllPosts(collectedPosts);

    setSnapshots(currentSnapshots);
    setPrevSnapshots((prevRes.data ?? []) as SnapshotData[]);
    setTrendData((trendRes.data ?? []) as SnapshotData[]);

    const platforms = [...new Set((connectionsRes.data ?? []).map((c: any) => c.platform as PlatformType))];
    setAvailablePlatforms(platforms);

    const hasRealData = currentSnapshots.some((snapshot) =>
      Object.entries(snapshot.metrics_data).some(([key, v]) => typeof v === "number" && v > 0 && !HIDDEN_METRICS.has(key)),
    );

    if (!hasAutoDetected && !hasRealData && (trendRes.data ?? []).length > 0) {
      const allSnaps = (trendRes.data ?? []) as SnapshotData[];
      const monthsWithData = new Map<string, { m: number; y: number; total: number }>();
      for (const s of allSnaps) {
        const key = `${s.report_year}-${s.report_month}`;
        const existing = monthsWithData.get(key) || { m: s.report_month, y: s.report_year, total: 0 };
        existing.total += Object.entries(s.metrics_data).filter(([k]) => !HIDDEN_METRICS.has(k)).reduce((sum, [, v]) => sum + (typeof v === "number" ? Math.abs(v) : 0), 0);
        monthsWithData.set(key, existing);
      }
      const sorted = Array.from(monthsWithData.values()).filter(d => d.total > 0).sort((a, b) => (a.y !== b.y ? b.y - a.y : b.m - a.m));
      if (sorted.length > 0) setSelectedPeriod(prev => ({ ...prev, month: sorted[0].m, year: sorted[0].y }));
      setHasAutoDetected(true);
    } else if (!hasAutoDetected) { setHasAutoDetected(true); }

    setIsLoading(false);
  }, [clientId, selectedPeriod, hasAutoDetected]);

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

  // ─── Computed Data ───────────────────────────────────────────
  const filtered = useMemo(() => (selectedPlatform === "all" ? snapshots : snapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [snapshots, selectedPlatform]);
  const filteredPrev = useMemo(() => (selectedPlatform === "all" ? prevSnapshots : prevSnapshots.filter(s => matchesPlatformFilter(selectedPlatform, s.platform))), [prevSnapshots, selectedPlatform]);

  const kpis = useMemo(() => {
    const totalSpend = filtered.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const totalReach = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const totalClicks = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0); }, 0);
    const totalEngagement = filtered.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const totalFollowers = Math.max(...filtered.map(s => s.metrics_data.total_followers || 0), 0);
    const totalSessions = filtered.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const totalVideoViews = filtered.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
    const totalConversions = filtered.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);
    const totalPageViews = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0); }, 0);
    const totalWebsiteClicks = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0); }, 0);

    const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const prevReach = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const prevClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0); }, 0);
    const prevEngagement = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const prevSessions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const prevVideoViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
    const prevConversions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);
    const prevPageViews = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0); }, 0);
    const prevWebsiteClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0); }, 0);

    const cc = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / prev) * 100 : undefined);

    // Helper to collect platforms contributing to a metric
    const platformsFor = (metricFn: (m: Record<string, number>) => number): PlatformType[] =>
      [...new Set(filtered.filter(s => metricFn(s.metrics_data) > 0).map(s => s.platform))];

    const spendPlatforms = platformsFor(m => m.spend || 0);
    const reachPlatforms = platformsFor(m => m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0);
    const clicksPlatforms = platformsFor(m => (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0));
    const engagementPlatforms = platformsFor(m => m.engagement ? m.engagement : (m.likes || 0) + (m.comments || 0) + (m.shares || 0));
    const followerPlatforms = platformsFor(m => m.total_followers || 0);
    const sessionsPlatforms = platformsFor(m => m.sessions || 0);
    const videoViewsPlatforms = platformsFor(m => m.video_views || 0);
    const conversionsPlatforms = platformsFor(m => m.conversions || 0);
    const pageViewsPlatforms = platformsFor(m => (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0));
    const websiteClicksPlatforms = platformsFor(m => (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0));

    return [
      ...((selectedPlatform === 'all' || filterIncludesPlatform(selectedPlatform, 'meta_ads') || filterIncludesPlatform(selectedPlatform, 'google_ads')) && totalSpend > 0 ? [{ label: "Total Spend", value: totalSpend, change: cc(totalSpend, prevSpend), icon: Banknote, isCost: true, metricKey: "spend", platforms: spendPlatforms }] : []),
      ...(totalVideoViews > 0 ? [{ label: "Video Views", value: totalVideoViews, change: cc(totalVideoViews, prevVideoViews), icon: Eye, metricKey: "video_views", platforms: videoViewsPlatforms }] : []),
      ...(totalReach > 0 ? [{ label: "Reach", value: totalReach, change: cc(totalReach, prevReach), icon: Eye, metricKey: "reach", platforms: reachPlatforms }] : []),
      ...(totalClicks > 0 ? [{ label: "Clicks", value: totalClicks, change: cc(totalClicks, prevClicks), icon: MousePointerClick, metricKey: "clicks", platforms: clicksPlatforms }] : []),
      ...(totalEngagement > 0 ? [{ label: "Engagement", value: totalEngagement, change: cc(totalEngagement, prevEngagement), icon: MessageCircle, metricKey: "engagement", platforms: engagementPlatforms }] : []),
      ...(totalFollowers > 0 ? [{ label: "Followers", value: totalFollowers, change: undefined as number | undefined, icon: Users, metricKey: "total_followers", platforms: followerPlatforms }] : []),
      ...(totalSessions > 0 ? [{ label: "Sessions", value: totalSessions, change: cc(totalSessions, prevSessions), icon: Activity, metricKey: "sessions", platforms: sessionsPlatforms }] : []),
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
      existing.reach = (existing.reach || 0) + (s.metrics_data.reach || s.metrics_data.impressions || s.metrics_data.search_impressions || s.metrics_data.views || s.metrics_data.gbp_views || 0);
      existing.clicks = (existing.clicks || 0) + (s.metrics_data.clicks || 0) + (s.metrics_data.search_clicks || 0) + (s.metrics_data.gbp_website_clicks || 0);
      existing.engagement = (existing.engagement || 0) + (s.metrics_data.engagement ? s.metrics_data.engagement : (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0));
      existing.total_followers = Math.max(existing.total_followers || 0, s.metrics_data.total_followers || 0);
      existing.video_views = (existing.video_views || 0) + (s.metrics_data.video_views || 0);
      existing.sessions = (existing.sessions || 0) + (s.metrics_data.sessions || 0);
      monthMap.set(key, existing);
    }
    const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    for (const metricKey of ["spend", "reach", "clicks", "engagement", "total_followers", "video_views", "sessions"]) {
      map[metricKey] = sorted.map(([key, data]) => { const [y, m] = key.split("-"); return { v: data[metricKey] || 0, name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}` }; });
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

  // Per-platform trend data
  const platformTrendMap = useMemo(() => {
    const map = new Map<PlatformType, Array<{ name: string; [key: string]: number | string }>>();
    for (const s of trendData) {
      const existing = map.get(s.platform) || [];
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      // Find or create entry for this month
      let entry = existing.find(e => (e as any)._key === key);
      if (!entry) {
        const [y, m] = key.split("-");
        entry = { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, _key: key } as any;
        existing.push(entry);
      }
      // Add all metric values
      for (const [mk, mv] of Object.entries(s.metrics_data)) {
        if (typeof mv === 'number') (entry as any)[mk] = ((entry as any)[mk] || 0) + mv;
      }
      map.set(s.platform, existing);
    }
    // Sort each platform's trend data
    for (const [platform, data] of map) {
      data.sort((a, b) => ((a as any)._key as string).localeCompare((b as any)._key as string));
      map.set(platform, data.slice(-6));
    }
    return map;
  }, [trendData]);

  const lastSyncedAt = useMemo(() => {
    const syncDates = connections.filter(c => c.last_sync_at).map(c => new Date(c.last_sync_at!).getTime());
    return syncDates.length === 0 ? null : new Date(Math.max(...syncDates));
  }, [connections]);

  const hasData = snapshots.length > 0;
  const hasFilteredData = filtered.length > 0;
  const allZeros = hasFilteredData && kpis.every(k => k.value === 0);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardHeader
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          availablePlatforms={availablePlatforms}
        />
        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
            </div>
          )}
          <Button
            size="sm"
            variant={aiAnalysis ? "outline" : "default"}
            onClick={handleAnalyse}
            disabled={isAnalysing || cooldownRemaining > 0}
            className="gap-2"
          >
            {isAnalysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isAnalysing ? "Analysing..." : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : aiAnalysis ? "Refresh Analysis" : "AI Analysis"}
          </Button>
        </div>
      </div>

      {/* AI Analysis Card */}
      {aiAnalysis && aiAnalysisDate && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold font-body">AI Analysis</CardTitle>
              <span className="text-[10px] text-muted-foreground">{format(aiAnalysisDate, "dd MMM yyyy, HH:mm")}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAnalysisDialogOpen(true)}>View Full Analysis</Button>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground line-clamp-3 prose prose-sm max-w-none">
              <ReactMarkdown>{aiAnalysis.split('\n')[0]}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Performance Analysis
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none text-foreground [&_strong]:font-bold [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No performance data available</p>
            <p className="text-sm text-muted-foreground/70">Sync platform data for this period to see your dashboard.</p>
          </CardContent>
        </Card>
      ) : !hasFilteredData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <PieChartIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No data for this platform</p>
            <p className="text-sm text-muted-foreground/70">Try selecting "All Platforms" or sync data for this platform.</p>
          </CardContent>
        </Card>
      ) : allZeros ? (
        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-12 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
            <p className="text-muted-foreground font-medium">No activity recorded for this period</p>
            <p className="text-sm text-muted-foreground/70">Try selecting a different period or sync historical data.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* 1. Hero KPIs */}
          <HeroKPIs kpis={kpis} currSymbol={currSymbol} sparklineMap={sparklineMap} />

          {/* 2. Performance Overview Charts */}
          <PerformanceOverview
            spendByPlatform={spendByPlatform}
            totalSpend={totalSpend}
            currSymbol={currSymbol}
            engagementStackedData={engagementStackedData as unknown as Array<Record<string, unknown>>}
            impressionsByPlatform={impressionsByPlatform as unknown as Array<Record<string, unknown>>}
            trendChartData={trendChartData as unknown as Array<Record<string, unknown>>}
          />

          {/* 3. Platform Sections */}
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-body">Platform Breakdown</h2>
            {filtered.map(snapshot => {
              const prevSnapshot = filteredPrev.find(s => s.platform === snapshot.platform);
              const connection = connections.find(c => c.platform === snapshot.platform);
              const config = platformConfigs.get(snapshot.platform);
              const platformPosts = allPosts.filter(p => p.platform === snapshot.platform);
              const platformTrend = platformTrendMap.get(snapshot.platform);

              return (
                <PlatformSection
                  key={snapshot.platform}
                  platform={snapshot.platform}
                  metricsData={snapshot.metrics_data}
                  prevMetricsData={prevSnapshot?.metrics_data}
                  connection={connection}
                  connectionId={connection?.id}
                  topContent={platformPosts}
                  trendData={platformTrend}
                  currSymbol={currSymbol}
                  enabledMetrics={config?.enabled_metrics}
                  reportMonth={selectedPeriod.month}
                  reportYear={selectedPeriod.year}
                  onSyncComplete={fetchSnapshots}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
