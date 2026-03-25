import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { subMonths, formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Banknote,
  Eye,
  MousePointerClick,
  MessageCircle,
  Users,
  BarChart3,
  PieChartIcon,
  AlertCircle,
  Clock,
  Loader2,
  TrendingUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PLATFORM_LOGOS } from "@/types/database";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
} from "recharts";
import PlatformMetricsCard from "./PlatformMetricsCard";
import SectionHeader from "./SectionHeader";
import DashboardHeader, { type SelectedPeriod, type PlatformFilter } from "./DashboardHeader";
import AudienceMap from "./AudienceMap";
import { PLATFORM_LABELS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from "@/types/database";
import { METRIC_EXPLANATIONS } from "@/types/metrics";
import type { PlatformType, JobStatus } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#b32fbf", "#539BDB", "#4ED68E", "#EE8733", "#241f21", "#8b5cf6"];

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
}

interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  top_content?: TopContentItem[];
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

// ─── Animated Counter Component ────────────────────────────────
function useAnimatedCounter(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>();

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) {
      setCurrent(target);
      return;
    }
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + diff * eased);
      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
      }
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [target, duration]);

  return current;
}

const formatKpiValue = (val: number, isCurrency: boolean, currSymbol: string): string => {
  if (isCurrency)
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
};

// ─── KPI Sparkline Card ────────────────────────────────────────
interface KpiCardProps {
  label: string;
  metricKey: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  isCost?: boolean;
  sparklineData: Array<{ v: number; name: string }>;
  currSymbol: string;
}

const SparklineTooltipContent = ({ active, payload, currSymbol, isCost }: any) => {
  if (!active || !payload?.[0]) return null;
  const { v, name } = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">
        {isCost ? `${currSymbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : v.toLocaleString()}
      </p>
    </div>
  );
};

const KpiCard = ({ label, metricKey, value, change, icon: Icon, isCost, sparklineData, currSymbol }: KpiCardProps) => {
  const animatedValue = useAnimatedCounter(value);
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const bgTint =
    change !== undefined ? (isPositive ? "rgba(78, 214, 142, 0.05)" : "rgba(239, 68, 68, 0.05)") : undefined;
  const explanation = METRIC_EXPLANATIONS[metricKey];

  return (
    <Card className="relative overflow-hidden" style={bgTint ? { backgroundColor: bgTint } : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
            {label}
          </p>
        </div>
        <p className="text-xl font-display font-bold leading-none mb-1">
          {formatKpiValue(animatedValue, !!isCost, currSymbol)}
        </p>
        {change !== undefined && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
              isPositive === true ? "bg-accent/10 text-accent" : isPositive === false ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}
          >
            <span>
              {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(1)}% from last month
            </span>
          </div>
        )}
        {/* Sparkline with interactive tooltip */}
        {sparklineData.length > 1 && (
          <div className="mt-2 -mx-1">
            <ResponsiveContainer width="100%" height={50}>
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b32fbf" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#b32fbf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#b32fbf"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label.replace(/\s/g, "")})`}
                  dot={false}
                  activeDot={{ r: 4, fill: "#b32fbf", stroke: "#fff", strokeWidth: 2 }}
                />
                <RechartsTooltip
                  content={<SparklineTooltipContent currSymbol={currSymbol} isCost={isCost} />}
                  cursor={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {explanation && (
          <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">{explanation}</p>
        )}
        {value === 0 && !explanation && <p className="text-[10px] text-muted-foreground/50 mt-1 italic">Data unavailable</p>}
      </CardContent>
    </Card>
  );
};

// ─── Dashboard Skeleton ────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-8">
    {/* KPI skeletons */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-[50px] w-full rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
    {/* Chart skeletons */}
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
    {/* Platform card skeletons */}
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ─── Custom Centre Label for Donut ─────────────────────────────
const DonutCentreLabel = ({ viewBox, value }: any) => {
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.3em" className="fill-foreground text-lg font-bold">
        {value}
      </tspan>
      <tspan x={cx} dy="1.4em" className="fill-muted-foreground text-[10px]">
        Total
      </tspan>
    </text>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────
const ClientDashboard = ({ clientId, clientName, currencyCode = "GBP" }: ClientDashboardProps) => {
  const currSymbol = getCurrencySymbol(currencyCode);
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>({
    type: "monthly",
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
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiAnalysisDate, setAiAnalysisDate] = useState<Date | null>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [allPosts, setAllPosts] = useState<(TopContentItem & { platform: PlatformType })[]>([]);

  useEffect(() => {
    setHasAutoDetected(false);
  }, [clientId]);

  const fetchSnapshots = useCallback(async () => {
    setIsLoading(true);
    const { month, year, type, startDate, endDate } = selectedPeriod;

    let query = supabase
      .from("monthly_snapshots")
      .select("platform, metrics_data, top_content, report_month, report_year")
      .eq("client_id", clientId);

    let isMultiMonth = false;

    if (type === "quarterly") {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      query = query.in("report_month", [qStart, qStart + 1, qStart + 2]).eq("report_year", year);
      isMultiMonth = true;
    } else if (type === "ytd") {
      const currentMonth = new Date().getMonth() + 1;
      const ytdMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);
      query = query.in("report_month", ytdMonths).eq("report_year", year);
      isMultiMonth = true;
    } else if (type === "last_year") {
      query = query.eq("report_year", year);
      isMultiMonth = true;
    } else if (type === "maximum") {
      isMultiMonth = true;
    } else if (type === "custom" && startDate && endDate) {
      const sMonth = startDate.getMonth() + 1;
      const sYear = startDate.getFullYear();
      const eMonth = endDate.getMonth() + 1;
      const eYear = endDate.getFullYear();
      if (sYear === eYear) {
        const customMonths = Array.from({ length: eMonth - sMonth + 1 }, (_, i) => sMonth + i);
        query = query.in("report_month", customMonths).eq("report_year", sYear);
      } else {
        query = query.or(
          `and(report_year.eq.${sYear},report_month.gte.${sMonth}),and(report_year.gt.${sYear},report_year.lt.${eYear}),and(report_year.eq.${eYear},report_month.lte.${eMonth})`,
        );
      }
      isMultiMonth = true;
    } else {
      query = query.eq("report_month", month).eq("report_year", year);
    }

    let prevMonth = month;
    let prevYear = year;
    const showComparison = type === "weekly" || type === "monthly" || type === "quarterly";
    if (type === "quarterly") {
      const d = subMonths(new Date(year, month - 1), 3);
      prevMonth = d.getMonth() + 1;
      prevYear = d.getFullYear();
    } else {
      prevMonth = month === 1 ? 12 : month - 1;
      prevYear = month === 1 ? year - 1 : year;
    }

    const sixMonthsAgo = new Date(year, month - 1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startMonth = sixMonthsAgo.getMonth() + 1;
    const startYear = sixMonthsAgo.getFullYear();

    const [currentRes, prevRes, trendRes, connectionsRes, configRes] = await Promise.all([
      query,
      showComparison
        ? supabase
            .from("monthly_snapshots")
            .select("platform, metrics_data, report_month, report_year")
            .eq("client_id", clientId)
            .eq("report_month", prevMonth)
            .eq("report_year", prevYear)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("monthly_snapshots")
        .select("platform, metrics_data, report_month, report_year")
        .eq("client_id", clientId)
        .or(`report_year.gt.${startYear},and(report_year.eq.${startYear},report_month.gte.${startMonth})`)
        .order("report_year", { ascending: true })
        .order("report_month", { ascending: true }),
      supabase
        .from("platform_connections")
        .select("platform, last_sync_at, last_sync_status, last_error")
        .eq("client_id", clientId)
        .eq("is_connected", true),
      supabase.from("client_platform_config").select("platform, is_enabled, enabled_metrics").eq("client_id", clientId),
    ]);

    setConnections((connectionsRes.data ?? []) as ConnectionData[]);

    const configMap = new Map<string, PlatformConfigData>();
    for (const c of (configRes.data ?? []) as PlatformConfigData[]) {
      configMap.set(c.platform, c);
    }
    setPlatformConfigs(configMap);

    let currentSnapshots = (currentRes.data ?? []) as SnapshotData[];
    if (isMultiMonth && currentSnapshots.length > 0) {
      const grouped = new Map<PlatformType, Record<string, number>>();
      for (const s of currentSnapshots) {
        const existing = grouped.get(s.platform) || {};
        for (const [k, v] of Object.entries(s.metrics_data)) {
          if (typeof v === "number") {
            if (k === "total_followers") {
              existing[k] = Math.max(existing[k] || 0, v);
            } else {
              existing[k] = (existing[k] || 0) + v;
            }
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

    // Collect all top_content posts from raw snapshots (before aggregation)
    const rawSnapshots = (currentRes.data ?? []) as SnapshotData[];
    const collectedPosts: (TopContentItem & { platform: PlatformType })[] = [];
    for (const s of rawSnapshots) {
      if (Array.isArray(s.top_content) && s.top_content.length > 0) {
        for (const post of s.top_content) {
          collectedPosts.push({ ...post, platform: s.platform });
        }
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
      Object.entries(snapshot.metrics_data).some(
        ([key, v]) => typeof v === "number" && v > 0 && !HIDDEN_METRICS.has(key),
      ),
    );

    if (!hasAutoDetected && !hasRealData && (trendRes.data ?? []).length > 0) {
      const allSnaps = (trendRes.data ?? []) as SnapshotData[];
      const monthsWithData = new Map<string, { m: number; y: number; total: number }>();
      for (const s of allSnaps) {
        const key = `${s.report_year}-${s.report_month}`;
        const existing = monthsWithData.get(key) || { m: s.report_month, y: s.report_year, total: 0 };
        const total = Object.entries(s.metrics_data)
          .filter(([k]) => !HIDDEN_METRICS.has(k))
          .reduce((sum, [, v]) => sum + (typeof v === "number" ? Math.abs(v) : 0), 0);
        existing.total += total;
        monthsWithData.set(key, existing);
      }
      const sorted = Array.from(monthsWithData.values())
        .filter((d) => d.total > 0)
        .sort((a, b) => (a.y !== b.y ? b.y - a.y : b.m - a.m));
      if (sorted.length > 0) setSelectedPeriod((prev) => ({ ...prev, month: sorted[0].m, year: sorted[0].y }));
      setHasAutoDetected(true);
    } else if (!hasAutoDetected) {
      setHasAutoDetected(true);
    }

    setIsLoading(false);
  }, [clientId, selectedPeriod, hasAutoDetected]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Rate limit cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lastAnalysisTime + 60000 - Date.now()) / 1000));
      setCooldownRemaining(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining, lastAnalysisTime]);

  const handleAnalyse = async () => {
    const now = Date.now();
    if (now - lastAnalysisTime < 60000) {
      toast.error(
        `Please wait ${Math.ceil((lastAnalysisTime + 60000 - now) / 1000)}s before generating another analysis`,
      );
      return;
    }
    setIsAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client", {
        body: { client_id: clientId, month: selectedPeriod.month, year: selectedPeriod.year },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAiAnalysis(data.analysis || "No analysis available.");
      setAiAnalysisDate(new Date());
      setLastAnalysisTime(Date.now());
      setCooldownRemaining(60);
      setAnalysisDialogOpen(true);
    } catch (e) {
      console.error("Analysis error:", e);
      toast.error("Failed to generate AI analysis");
    } finally {
      setIsAnalysing(false);
    }
  };

  const filtered = useMemo(
    () => (selectedPlatform === "all" ? snapshots : snapshots.filter((s) => s.platform === selectedPlatform)),
    [snapshots, selectedPlatform],
  );
  const filteredPrev = useMemo(
    () => (selectedPlatform === "all" ? prevSnapshots : prevSnapshots.filter((s) => s.platform === selectedPlatform)),
    [prevSnapshots, selectedPlatform],
  );

  const filteredPosts = useMemo(
    () => (selectedPlatform === "all" ? allPosts : allPosts.filter((p) => p.platform === selectedPlatform)),
    [allPosts, selectedPlatform],
  );

  const kpis = useMemo(() => {
    const totalSpend = filtered.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const totalReach = filtered.reduce((sum, s) => sum + (s.metrics_data.reach || s.metrics_data.impressions || 0), 0);
    const totalClicks = filtered.reduce((sum, s) => sum + (s.metrics_data.clicks || 0), 0);
    const totalEngagement = filtered.reduce((sum, s) => {
      const m = s.metrics_data;
      // Use pre-aggregated engagement if available (avoids double-counting for TikTok etc.)
      if (m.engagement) return sum + m.engagement;
      return sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    }, 0);
    const totalFollowers = Math.max(...filtered.map((s) => s.metrics_data.total_followers || 0), 0);
    const totalLinkClicks = filtered.reduce((sum, s) => sum + (s.metrics_data.link_clicks || 0), 0);
    const totalPageViews = filtered.reduce((sum, s) => sum + (s.metrics_data.page_views || 0), 0);

    const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const prevReach = filteredPrev.reduce(
      (sum, s) => sum + (s.metrics_data.reach || s.metrics_data.impressions || 0),
      0,
    );
    const prevClicks = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.clicks || 0), 0);
    const prevEngagement = filteredPrev.reduce((sum, s) => {
      const m = s.metrics_data;
      if (m.engagement) return sum + m.engagement;
      return sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    }, 0);
    const prevLinkClicks = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.link_clicks || 0), 0);
    const prevPageViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.page_views || 0), 0);

    const calcChange = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / prev) * 100 : undefined);

    const totalVideoViews = filtered.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
    const prevVideoViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);

    return [
      ...(["all", "meta_ads", "google_ads"].includes(selectedPlatform)
        ? [
            {
              label: "Total Spend",
              value: totalSpend,
              change: calcChange(totalSpend, prevSpend),
              icon: Banknote,
              isCost: true,
              metricKey: "spend",
            },
          ]
        : []),
      ...(selectedPlatform === "tiktok"
        ? [
            {
              label: "Video Views",
              value: totalVideoViews,
              change: calcChange(totalVideoViews, prevVideoViews),
              icon: Eye,
              metricKey: "video_views",
            },
          ]
        : []),
      { label: "Reach", value: totalReach, change: calcChange(totalReach, prevReach), icon: Eye, metricKey: "reach" },
      {
        label: "Clicks",
        value: totalClicks,
        change: calcChange(totalClicks, prevClicks),
        icon: MousePointerClick,
        metricKey: "clicks",
      },
      {
        label: "Engagement",
        value: totalEngagement,
        change: calcChange(totalEngagement, prevEngagement),
        icon: MessageCircle,
        metricKey: "engagement",
      },
      ...(totalFollowers > 0
        ? [
            {
              label: "Followers",
              value: totalFollowers,
              change: undefined as number | undefined,
              icon: Users,
              metricKey: "total_followers",
            },
          ]
        : []),
      ...(totalLinkClicks > 0
        ? [
            {
              label: "Link Clicks",
              value: totalLinkClicks,
              change: calcChange(totalLinkClicks, prevLinkClicks),
              icon: MousePointerClick,
              metricKey: "link_clicks",
            },
          ]
        : []),
      ...(totalPageViews > 0
        ? [
            {
              label: "Page Views",
              value: totalPageViews,
              change: calcChange(totalPageViews, prevPageViews),
              icon: Eye,
              metricKey: "page_views",
            },
          ]
        : []),
    ];
  }, [filtered, filteredPrev]);

  // ─── Sparkline data per KPI from trend ───────────────────────
  const sparklineMap = useMemo(() => {
    const map: Record<string, Array<{ v: number; name: string }>> = {};
    const relevantTrend =
      selectedPlatform === "all" ? trendData : trendData.filter((s) => s.platform === selectedPlatform);
    const monthMap = new Map<string, Record<string, number>>();

    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || {};
      existing.spend = (existing.spend || 0) + (s.metrics_data.spend || 0);
      existing.reach = (existing.reach || 0) + (s.metrics_data.reach || s.metrics_data.impressions || 0);
      existing.clicks = (existing.clicks || 0) + (s.metrics_data.clicks || 0);
      existing.engagement =
        (existing.engagement || 0) +
        (s.metrics_data.engagement
          ? s.metrics_data.engagement
          : (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0));
      existing.total_followers = Math.max(existing.total_followers || 0, s.metrics_data.total_followers || 0);
      existing.link_clicks = (existing.link_clicks || 0) + (s.metrics_data.link_clicks || 0);
      existing.page_views = (existing.page_views || 0) + (s.metrics_data.page_views || 0);
      existing.video_views = (existing.video_views || 0) + (s.metrics_data.video_views || 0);
      monthMap.set(key, existing);
    }

    const sorted = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
    for (const metricKey of ["spend", "reach", "clicks", "engagement", "total_followers", "link_clicks", "page_views", "video_views"]) {
      map[metricKey] = sorted.map(([key, data]) => {
        const [y, m] = key.split("-");
        return { v: data[metricKey] || 0, name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}` };
      });
    }
    return map;
  }, [trendData, selectedPlatform]);

  // ─── Chart Data ──────────────────────────────────────────────
  const spendByPlatform = useMemo(
    () =>
      filtered
        .filter((s) => s.metrics_data.spend > 0)
        .map((s) => ({
          name: PLATFORM_LABELS[s.platform] || s.platform,
          value: Math.round(s.metrics_data.spend * 100) / 100,
        })),
    [filtered],
  );

  const totalSpend = useMemo(() => spendByPlatform.reduce((s, d) => s + d.value, 0), [spendByPlatform]);

  // Engagement breakdown as stacked bar (likes, comments, shares per platform)
  const engagementStackedData = useMemo(
    () =>
      filtered
        .filter((s) => {
          const eng =
            (s.metrics_data.likes || 0) +
            (s.metrics_data.comments || 0) +
            (s.metrics_data.shares || 0) +
            (s.metrics_data.engagement || 0);
          return eng > 0;
        })
        .map((s) => ({
          name: PLATFORM_LABELS[s.platform] || s.platform,
          likes: s.metrics_data.likes || 0,
          comments: s.metrics_data.comments || 0,
          shares: s.metrics_data.shares || 0,
          saves: s.metrics_data.saves || 0,
        })),
    [filtered],
  );

  const impressionsByPlatform = useMemo(
    () =>
      filtered
        .filter((s) => s.metrics_data.impressions > 0)
        .map((s) => ({
          name: PLATFORM_LABELS[s.platform] || s.platform,
          impressions: s.metrics_data.impressions,
          clicks: s.metrics_data.clicks || 0,
        })),
    [filtered],
  );

  // Trend data for area chart
  const trendChartData = useMemo(() => {
    const monthMap = new Map<string, { spend: number; impressions: number; clicks: number; engagement: number; video_views: number; reach: number }>();
    const relevantTrend =
      selectedPlatform === "all" ? trendData : trendData.filter((s) => s.platform === selectedPlatform);
    for (const s of relevantTrend) {
      const key = `${s.report_year}-${String(s.report_month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { spend: 0, impressions: 0, clicks: 0, engagement: 0, video_views: 0, reach: 0 };
      existing.spend += s.metrics_data.spend || 0;
      existing.impressions += s.metrics_data.impressions || 0;
      existing.clicks += s.metrics_data.clicks || 0;
      existing.video_views += s.metrics_data.video_views || 0;
      existing.reach += s.metrics_data.reach || 0;
      existing.engagement +=
        s.metrics_data.engagement
          ? s.metrics_data.engagement
          : (s.metrics_data.likes || 0) + (s.metrics_data.comments || 0) + (s.metrics_data.shares || 0);
      monthMap.set(key, existing);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, data]) => {
        const [y, m] = key.split("-");
        return { name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}`, ...data };
      });
  }, [trendData, selectedPlatform]);

  // Geo data extracted from snapshots
  const geoData = useMemo(() => {
    const all: Array<{ lat: number; lng: number; value: number; label: string }> = [];
    for (const s of filtered) {
      const geo = (s.metrics_data as any)?.geo_data;
      if (Array.isArray(geo)) all.push(...geo);
    }
    return all;
  }, [filtered]);

  // Last synced timestamp
  const lastSyncedAt = useMemo(() => {
    const syncDates = connections.filter((c) => c.last_sync_at).map((c) => new Date(c.last_sync_at!).getTime());
    if (syncDates.length === 0) return null;
    return new Date(Math.max(...syncDates));
  }, [connections]);

  const hasData = snapshots.length > 0;
  const hasFilteredData = filtered.length > 0;
  const allZeros = hasFilteredData && kpis.every((k) => k.value === 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <DashboardHeader
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        availablePlatforms={availablePlatforms}
      />

      {/* Last synced + AI Analysis button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Last synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
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
          {isAnalysing
            ? "Analysing..."
            : cooldownRemaining > 0
              ? `Wait ${cooldownRemaining}s`
              : aiAnalysis
                ? "Refresh Analysis"
                : "Generate AI Analysis"}
        </Button>
      </div>

      {/* Saved AI Analysis Card */}
      {aiAnalysis && aiAnalysisDate && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-display">AI Analysis</CardTitle>
              <span className="text-[10px] text-muted-foreground">{format(aiAnalysisDate, "dd MMM yyyy, HH:mm")}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAnalysisDialogOpen(true)}>
              View Full Analysis
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">{aiAnalysis}</p>
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
          <div className="prose prose-sm max-w-none text-foreground">
            {aiAnalysis
              .split("\n")
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="text-sm leading-relaxed mb-3">
                  {para}
                </p>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* PART 4: Skeleton loading */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
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
          {/* PART 1: KPI Cards with Sparklines */}
          <SectionHeader
            title="Key Performance Indicators"
            description="Your top-level metrics at a glance — hover over the sparklines to see historical values"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                label={kpi.label}
                metricKey={kpi.metricKey}
                value={kpi.value}
                change={kpi.change}
                icon={kpi.icon}
                isCost={kpi.isCost}
                sparklineData={sparklineMap[kpi.metricKey] || []}
                currSymbol={currSymbol}
              />
            ))}
          </div>

          {/* PART 2: Charts */}
          <SectionHeader
            title="Spend & Engagement"
            description="How your budget is distributed and how people are interacting with your content"
            icon={<Banknote className="h-4 w-4 text-primary" />}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {/* Spend Distribution — Donut */}
            {spendByPlatform.length > 1 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <Banknote className="h-4 w-4" /> Spend Distribution
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">See how your ad budget is split across platforms</p>
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
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {spendByPlatform.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) =>
                          `${currSymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        }
                      />
                      <Legend />
                      {/* Centre total */}
                      <Pie
                        data={[{ value: 1 }]}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        outerRadius={0}
                        innerRadius={0}
                        fill="none"
                      >
                        <ReferenceLine />
                      </Pie>
                      <text
                        x="50%"
                        y="46%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-foreground text-base font-bold font-display"
                      >
                        {currSymbol}
                        {totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}K` : totalSpend.toFixed(0)}
                      </text>
                      <text
                        x="50%"
                        y="56%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-muted-foreground text-[10px]"
                      >
                        Total
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <Banknote className="h-4 w-4" /> Spend Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[260px]">
                  <p className="text-sm text-muted-foreground italic">No spend data available for this period</p>
                </CardContent>
              </Card>
            )}

            {/* Engagement Breakdown — Stacked Bar */}
            {engagementStackedData.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> Engagement Breakdown
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">How people are interacting with your content across platforms</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={engagementStackedData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="likes" name="Likes" stackId="eng" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="comments" name="Comments" stackId="eng" fill={CHART_COLORS[1]} />
                      <Bar dataKey="shares" name="Shares" stackId="eng" fill={CHART_COLORS[2]} />
                      <Bar dataKey="saves" name="Saves" stackId="eng" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> Engagement Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[260px]">
                  <p className="text-sm text-muted-foreground italic">No engagement data available for this period</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Impressions & Clicks — Grouped Bar */}
          {impressionsByPlatform.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Impressions & Clicks by Platform
                </CardTitle>
                <p className="text-xs text-muted-foreground">How many people saw your content vs how many took action</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={impressionsByPlatform} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Bar dataKey="impressions" name="Impressions" fill="#539BDB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clicks" name="Clicks" fill="#4ED68E" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Performance Trend — Area Chart */}
          <SectionHeader
            title="Performance Trend"
            description="How your key metrics have changed over the last 6 months — hover to see exact values"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
          {trendChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Performance Trend
                </CardTitle>
                <p className="text-xs text-muted-foreground">Track your impressions, clicks, and engagement over time</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b32fbf" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#b32fbf" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="trendGradientBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#539BDB" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#539BDB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="trendGradientGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ED68E" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#4ED68E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === "Spend" || name === "spend") return `${currSymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                        return value.toLocaleString();
                      }}
                    />
                    {trendChartData.some((d) => (d as any).impressions > 0) && (
                      <Area
                        type="monotone"
                        dataKey="impressions"
                        name="Impressions"
                        stroke="#b32fbf"
                        strokeWidth={2}
                        fill="url(#trendGradient)"
                        dot={{ r: 4, fill: "#b32fbf" }}
                      />
                    )}
                    {trendChartData.some((d) => (d as any).video_views > 0) && (
                      <Area
                        type="monotone"
                        dataKey="video_views"
                        name="Video Views"
                        stroke="#b32fbf"
                        strokeWidth={2}
                        fill="url(#trendGradient)"
                        dot={{ r: 4, fill: "#b32fbf" }}
                      />
                    )}
                    {trendChartData.some((d) => (d as any).reach > 0) && (
                      <Area
                        type="monotone"
                        dataKey="reach"
                        name="Reach"
                        stroke="#EE8733"
                        strokeWidth={2}
                        fill="none"
                        dot={{ r: 4, fill: "#EE8733" }}
                      />
                    )}
                    {trendChartData.some((d) => (d as any).clicks > 0) && (
                      <Area
                        type="monotone"
                        dataKey="clicks"
                        name="Clicks"
                        stroke="#539BDB"
                        strokeWidth={2}
                        fill="url(#trendGradientBlue)"
                        dot={{ r: 4, fill: "#539BDB" }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      name="Engagement"
                      stroke="#4ED68E"
                      strokeWidth={2}
                      fill="url(#trendGradientGreen)"
                      dot={{ r: 4, fill: "#4ED68E" }}
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* PART 5: Performance by Post */}
          {filteredPosts.length > 0 && (
            <div className="space-y-4">
              <SectionHeader
                title="Performance by Post"
                description="How each piece of content performed this period"
                icon={<FileText className="h-4 w-4 text-primary" />}
              />
              <Card>
                <CardContent className="p-0">
                  <div className="relative w-full overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[280px]">Post</TableHead>
                          <TableHead className="text-right">Reach</TableHead>
                          <TableHead className="text-right">Likes & Reactions</TableHead>
                          <TableHead className="text-right">Comments</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Eng. Rate</TableHead>
                          <TableHead className="text-right w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPosts.map((post, idx) => {
                          const engagement = post.total_engagement ?? 0;
                          const reach = post.reach ?? 0;
                          const engRate = reach > 0 ? ((engagement / reach) * 100).toFixed(1) : "—";
                          const text = post.message || post.caption || "";
                          const dateStr = post.created_time || post.timestamp;
                          const platformLogo = PLATFORM_LOGOS[post.platform];

                          return (
                            <TableRow key={`${post.permalink_url || idx}-${idx}`}>
                              <TableCell>
                                <div className="flex items-start gap-3">
                                  {post.full_picture ? (
                                    <img
                                      src={post.full_picture}
                                      alt=""
                                      className="w-12 h-12 rounded-md object-cover shrink-0 bg-muted"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                    </div>
                                  )}
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-sm leading-snug line-clamp-2">
                                      {text || <span className="italic text-muted-foreground">No caption</span>}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {platformLogo && (
                                        <img src={platformLogo} alt="" className="w-4 h-4 rounded-sm" />
                                      )}
                                      {dateStr && (
                                        <span>{format(new Date(dateStr), "d MMM yyyy")}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {reach > 0 ? reach.toLocaleString() : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {(post.likes ?? 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {(post.comments ?? 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {(post.shares ?? 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {engRate !== "—" ? `${engRate}%` : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {post.permalink_url && (
                                  <a
                                    href={post.permalink_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PART 6: Audience Map */}
          <AudienceMap geoData={geoData} />

          {/* Per-Platform Metrics */}
          <div className="space-y-5">
            <SectionHeader
              title="Platform Details"
              description="Detailed breakdown of how each connected platform performed this period"
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
            />
            {filtered.length > 0 ? (
              filtered
                .filter((snapshot) => {
                  const config = platformConfigs.get(snapshot.platform);
                  if (config && !config.is_enabled) return false;
                  const isOrganic = ORGANIC_PLATFORMS.has(snapshot.platform);
                  const enabledMetrics = config?.enabled_metrics;
                  const hasVisibleNonZero = Object.entries(snapshot.metrics_data).some(
                    ([key, val]) =>
                      typeof val === "number" &&
                      val > 0 &&
                      !HIDDEN_METRICS.has(key) &&
                      !(isOrganic && AD_METRICS.has(key)) &&
                      (enabledMetrics && enabledMetrics.length > 0 ? enabledMetrics.includes(key) : true),
                  );
                  return hasVisibleNonZero;
                })
                .map((snapshot) => {
                  const prevSnapshot = filteredPrev.find((s) => s.platform === snapshot.platform);
                  const config = platformConfigs.get(snapshot.platform);
                  const conn = connections.find((c) => c.platform === snapshot.platform);
                  return (
                    <PlatformMetricsCard
                      key={snapshot.platform}
                      platform={snapshot.platform}
                      metrics={snapshot.metrics_data}
                      prevMetrics={prevSnapshot?.metrics_data}
                      currencyCode={currencyCode}
                      enabledMetrics={
                        config?.enabled_metrics && config.enabled_metrics.length > 0
                          ? config.enabled_metrics
                          : undefined
                      }
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

      {/* Demographics Placeholder */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Audience & Demographics
          </CardTitle>
          <p className="text-xs text-muted-foreground">Understanding who your audience is — age, location, and interests</p>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Audience insights coming soon</p>
          <p className="text-xs text-muted-foreground/60">
            Demographics, age groups, and geographic data will appear here once available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboard;
