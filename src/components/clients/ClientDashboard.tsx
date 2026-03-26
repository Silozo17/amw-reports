import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { subMonths, formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Banknote, Eye, MousePointerClick, MessageCircle, Users,
  BarChart3, PieChartIcon, AlertCircle, Clock, Loader2, TrendingUp,
  ExternalLink, FileText, Image as ImageIcon, Globe, Search, PlayCircle, Activity, Pencil, Lock,
  ArrowUpDown,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { PLATFORM_LOGOS } from "@/types/database";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";
import SectionHeader from "./SectionHeader";
import DashboardHeader, { type SelectedPeriod, type PlatformFilter } from "./DashboardHeader";
import AudienceMap from "./AudienceMap";
import { PLATFORM_LABELS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from "@/types/database";
import { METRIC_EXPLANATIONS } from "@/types/metrics";
import type { PlatformType, JobStatus } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DashboardWidget, WidgetData, WidgetType } from "@/types/widget";
import { COMPATIBLE_TYPES } from "@/types/widget";
import DashboardGrid from "./widgets/DashboardGrid";
import WidgetPanel from "./widgets/WidgetPanel";

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

/** Check whether a platform passes the current filter */
const matchesPlatformFilter = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

/** Check whether the filter includes a specific platform (for table sections) */
const filterIncludesPlatform = (filter: PlatformFilter, platform: PlatformType): boolean =>
  filter === 'all' || filter.includes(platform);

// ─── Dashboard Skeleton ────────────────────────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-8">
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
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-[260px] w-full rounded" /></CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ─── Widget Generation ─────────────────────────────────────────
interface KpiItem {
  label: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  isCost?: boolean;
  metricKey: string;
}

function generateDefaultWidgets(
  kpis: KpiItem[],
  hasSpendDistribution: boolean,
  hasEngagementBreakdown: boolean,
  hasImpressions: boolean,
  hasTrend: boolean,
  hasPosts: boolean,
  hasGscData: boolean,
  hasGaPages: boolean,
  hasGaSources: boolean,
  hasYtVideos: boolean,
  filtered: SnapshotData[],
  platformConfigs: Map<string, PlatformConfigData>,
): DashboardWidget[] {
  const widgets: DashboardWidget[] = [];
  let y = 0;

  // KPI widgets
  kpis.forEach((kpi, i) => {
    widgets.push({
      id: `kpi-${kpi.metricKey}`,
      dataSource: `kpi-${kpi.metricKey}`,
      label: kpi.label,
      description: METRIC_EXPLANATIONS[kpi.metricKey] || 'Key performance metric',
      type: 'number',
      category: 'kpi',
      visible: true,
      position: { x: (i % 6) * 2, y: Math.floor(i / 6) * 2, w: 2, h: 2, minW: 2, minH: 2 },
      compatibleTypes: COMPATIBLE_TYPES.kpi,
    });
  });
  y = Math.ceil(kpis.length / 6) * 2;

  // Chart widgets
  if (hasSpendDistribution) {
    widgets.push({
      id: 'chart-spend-distribution', dataSource: 'chart-spend-distribution',
      label: 'Spend Distribution', description: 'How your ad budget is split across platforms',
      type: 'donut', category: 'chart', visible: true,
      position: { x: 0, y, w: 6, h: 4, minW: 4, minH: 3 },
      compatibleTypes: ['pie', 'donut', 'bar'],
    });
  }
  if (hasEngagementBreakdown) {
    widgets.push({
      id: 'chart-engagement-breakdown', dataSource: 'chart-engagement-breakdown',
      label: 'Engagement Breakdown', description: 'How people interact with your content',
      type: 'bar', category: 'chart', visible: true,
      position: { x: 6, y, w: 6, h: 4, minW: 4, minH: 3 },
      compatibleTypes: ['bar', 'radar', 'pie', 'donut'],
    });
  }
  if (hasSpendDistribution || hasEngagementBreakdown) y += 4;

  if (hasImpressions) {
    widgets.push({
      id: 'chart-impressions-clicks', dataSource: 'chart-impressions-clicks',
      label: 'Impressions & Clicks', description: 'How many people saw your content vs took action',
      type: 'bar', category: 'chart', visible: true,
      position: { x: 0, y, w: 6, h: 4, minW: 4, minH: 3 },
      compatibleTypes: ['bar', 'line', 'area'],
    });
  }
  if (hasTrend) {
    widgets.push({
      id: 'chart-performance-trend', dataSource: 'chart-performance-trend',
      label: 'Performance Trend', description: 'Key metrics over the last 6 months',
      type: 'area', category: 'chart', visible: true,
      position: { x: hasImpressions ? 6 : 0, y, w: 6, h: 4, minW: 4, minH: 3 },
      compatibleTypes: ['area', 'line', 'bar'],
    });
  }
  if (hasImpressions || hasTrend) y += 4;

  // Table widgets
  if (hasPosts) {
    widgets.push({ id: 'table-posts', dataSource: 'table-posts', label: 'Performance by Post', description: 'How each piece of content performed', type: 'table', category: 'table', visible: true, position: { x: 0, y, w: 12, h: 5, minW: 6, minH: 3 }, compatibleTypes: ['table'] });
    y += 5;
  }
  if (hasGscData) {
    widgets.push({ id: 'table-gsc-queries', dataSource: 'table-gsc-queries', label: 'Top Search Queries', description: 'Search terms people used to find your website', type: 'table', category: 'table', visible: true, position: { x: 0, y, w: 6, h: 4, minW: 4, minH: 3 }, compatibleTypes: ['table'], platform: 'google_search_console' });
    widgets.push({ id: 'table-gsc-pages', dataSource: 'table-gsc-pages', label: 'Top Pages (Search)', description: 'Pages that received the most search traffic', type: 'table', category: 'table', visible: true, position: { x: 6, y, w: 6, h: 4, minW: 4, minH: 3 }, compatibleTypes: ['table'], platform: 'google_search_console' });
    y += 4;
  }
  if (hasGaPages) {
    widgets.push({ id: 'table-ga-pages', dataSource: 'table-ga-pages', label: 'Top Pages (Analytics)', description: 'Pages that received the most traffic', type: 'table', category: 'table', visible: true, position: { x: 0, y, w: 6, h: 4, minW: 4, minH: 3 }, compatibleTypes: ['table'], platform: 'google_analytics' });
  }
  if (hasGaSources) {
    widgets.push({ id: 'table-ga-sources', dataSource: 'table-ga-sources', label: 'Traffic Sources', description: 'Where your website visitors come from', type: 'table', category: 'table', visible: true, position: { x: hasGaPages ? 6 : 0, y, w: 6, h: 4, minW: 4, minH: 3 }, compatibleTypes: ['table'], platform: 'google_analytics' });
  }
  if (hasGaPages || hasGaSources) y += 4;
  if (hasYtVideos) {
    widgets.push({ id: 'table-yt-videos', dataSource: 'table-yt-videos', label: 'Top Videos', description: 'Your best-performing YouTube videos', type: 'table', category: 'table', visible: true, position: { x: 0, y, w: 12, h: 4, minW: 6, minH: 3 }, compatibleTypes: ['table'], platform: 'youtube' });
    y += 4;
  }

  // Platform metric widgets
  for (const snapshot of filtered) {
    const platform = snapshot.platform;
    const isOrganic = ORGANIC_PLATFORMS.has(platform);
    const config = platformConfigs.get(platform);
    const enabledMetrics = config?.enabled_metrics;
    let pIdx = 0;

    for (const [key, val] of Object.entries(snapshot.metrics_data)) {
      if (typeof val !== 'number') continue;
      if (HIDDEN_METRICS.has(key)) continue;
      if (isOrganic && AD_METRICS.has(key)) continue;
      if (enabledMetrics && enabledMetrics.length > 0 && !enabledMetrics.includes(key)) continue;

      widgets.push({
        id: `platform-${platform}-${key}`,
        dataSource: `platform-${platform}-${key}`,
        label: `${PLATFORM_LABELS[platform]} — ${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
        description: METRIC_EXPLANATIONS[key] || '',
        type: 'number',
        category: 'platform',
        visible: true,
        position: { x: (pIdx % 6) * 2, y: y + Math.floor(pIdx / 6) * 2, w: 2, h: 2, minW: 2, minH: 2 },
        compatibleTypes: COMPATIBLE_TYPES.platform,
        platform,
      });
      pIdx++;
    }
    y += Math.ceil(pIdx / 6) * 2;
  }

  return widgets;
}

// ─── Widget Data Map ───────────────────────────────────────────
function buildWidgetDataMap(
  kpis: KpiItem[],
  sparklineMap: Record<string, Array<{ v: number; name: string }>>,
  currSymbol: string,
  spendByPlatform: Array<{ name: string; value: number }>,
  totalSpend: number,
  engagementStackedData: Array<Record<string, unknown>>,
  impressionsByPlatform: Array<Record<string, unknown>>,
  trendChartData: Array<Record<string, unknown>>,
  filteredPosts: Array<TopContentItem & { platform: PlatformType }>,
  allPosts: Array<TopContentItem & { platform: PlatformType }>,
  selectedPlatform: PlatformFilter,
  filtered: SnapshotData[],
  filteredPrev: SnapshotData[],
): Record<string, WidgetData> {
  const map: Record<string, WidgetData> = {};

  // KPI data
  for (const kpi of kpis) {
    map[`kpi-${kpi.metricKey}`] = {
      value: kpi.value,
      change: kpi.change,
      isCost: kpi.isCost,
      currSymbol,
      sparklineData: sparklineMap[kpi.metricKey] ?? [],
    };
  }

  // Chart data
  if (spendByPlatform.length > 1) {
    map['chart-spend-distribution'] = {
      chartData: spendByPlatform as unknown as Array<Record<string, unknown>>,
      chartConfig: { dataKeys: ['value'], colors: CHART_COLORS, xAxisKey: 'name' },
      totalValue: `${currSymbol}${totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}K` : totalSpend.toFixed(0)}`,
      totalLabel: 'Total',
    };
  }

  if (engagementStackedData.length > 0) {
    map['chart-engagement-breakdown'] = {
      chartData: engagementStackedData,
      chartConfig: {
        dataKeys: ['likes', 'comments', 'shares', 'saves'],
        names: ['Likes', 'Comments', 'Shares', 'Saves'],
        colors: CHART_COLORS,
        xAxisKey: 'name',
        stacked: true,
      },
    };
  }

  if (impressionsByPlatform.length > 0) {
    map['chart-impressions-clicks'] = {
      chartData: impressionsByPlatform,
      chartConfig: {
        dataKeys: ['impressions', 'clicks'],
        names: ['Impressions', 'Clicks'],
        colors: ['#539BDB', '#4ED68E'],
        xAxisKey: 'name',
      },
    };
  }

  if (trendChartData.length > 0) {
    const dataKeys: string[] = [];
    const names: string[] = [];
    const colors: string[] = [];
    const sample = trendChartData[0] as Record<string, number>;
    if (trendChartData.some(d => (d as Record<string, number>).impressions > 0)) { dataKeys.push('impressions'); names.push('Impressions'); colors.push('#b32fbf'); }
    if (trendChartData.some(d => (d as Record<string, number>).clicks > 0)) { dataKeys.push('clicks'); names.push('Clicks'); colors.push('#539BDB'); }
    if (trendChartData.some(d => (d as Record<string, number>).engagement > 0)) { dataKeys.push('engagement'); names.push('Engagement'); colors.push('#4ED68E'); }
    if (trendChartData.some(d => (d as Record<string, number>).reach > 0)) { dataKeys.push('reach'); names.push('Reach'); colors.push('#EE8733'); }

    map['chart-performance-trend'] = {
      chartData: trendChartData,
      chartConfig: { dataKeys, names, colors, xAxisKey: 'name' },
    };
  }

  // Table data
  const socialPosts = filteredPosts.filter(p => p.message || p.caption);
  if (socialPosts.length > 0) {
    map['table-posts'] = {
      tableColumns: [
        { key: 'image', label: '', type: 'image' },
        { key: 'platform', label: '', type: 'platform' },
        { key: 'content', label: 'Post' },
        { key: 'reach', label: 'Reach', align: 'right' },
        { key: 'likes', label: 'Likes', align: 'right' },
        { key: 'comments', label: 'Comments', align: 'right' },
        { key: 'shares', label: 'Shares', align: 'right' },
        { key: 'engagement_rate', label: 'Eng. Rate', align: 'right' },
        { key: 'link', label: '', type: 'link' },
      ],
      tableData: socialPosts.map(p => {
        const totalEngagement = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
        const reachVal = p.reach ?? 0;
        const engRate = reachVal > 0 ? ((totalEngagement / reachVal) * 100).toFixed(1) + '%' : '—';
        return {
          image: p.full_picture ?? null,
          platform: p.platform ?? '',
          content: p.message || p.caption || 'No caption',
          reach: reachVal,
          likes: p.likes ?? 0,
          comments: p.comments ?? 0,
          shares: p.shares ?? 0,
          engagement_rate: engRate,
          link: p.permalink_url ?? null,
        };
      }) as unknown as Array<Record<string, unknown>>,
    };
  }

  // GSC data
  const gscPosts = filterIncludesPlatform(selectedPlatform, 'google_search_console')
    ? allPosts.filter(p => p.platform === 'google_search_console') : [];
  const gscQueries = gscPosts.filter(p => p.query);
  const gscPages = gscPosts.filter(p => p.page && !p.query);
  if (gscQueries.length > 0) {
    map['table-gsc-queries'] = {
      tableColumns: [
        { key: 'query', label: 'Query' },
        { key: 'clicks', label: 'Clicks', align: 'right' },
        { key: 'impressions', label: 'Impressions', align: 'right' },
        { key: 'ctr', label: 'CTR', align: 'right' },
      ],
      tableData: gscQueries.slice(0, 10).map(q => ({
        query: q.query,
        clicks: q.clicks ?? 0,
        impressions: q.impressions ?? 0,
        ctr: q.ctr != null ? `${(q.ctr * 100).toFixed(1)}%` : '—',
      })) as unknown as Array<Record<string, unknown>>,
    };
  }
  if (gscPages.length > 0) {
    map['table-gsc-pages'] = {
      tableColumns: [
        { key: 'page', label: 'Page' },
        { key: 'clicks', label: 'Clicks', align: 'right' },
        { key: 'impressions', label: 'Impressions', align: 'right' },
      ],
      tableData: gscPages.slice(0, 10).map(p => ({
        page: p.page, clicks: p.clicks ?? 0, impressions: p.impressions ?? 0,
      })) as unknown as Array<Record<string, unknown>>,
    };
  }

  // GA data
  const gaPosts = filterIncludesPlatform(selectedPlatform, 'google_analytics')
    ? allPosts.filter(p => p.platform === 'google_analytics' && (p.page || p.source)) : [];
  const gaPages = gaPosts.filter(p => p.page);
  const gaSources = gaPosts.filter(p => p.source && !p.page);
  if (gaPages.length > 0) {
    map['table-ga-pages'] = {
      tableColumns: [
        { key: 'page', label: 'Page Path' },
        { key: 'views', label: 'Views', align: 'right' },
        { key: 'sessions', label: 'Sessions', align: 'right' },
      ],
      tableData: gaPages.slice(0, 10).map(p => ({
        page: p.page, views: p.views ?? 0, sessions: p.sessions ?? 0,
      })) as unknown as Array<Record<string, unknown>>,
    };
  }
  if (gaSources.length > 0) {
    map['table-ga-sources'] = {
      tableColumns: [
        { key: 'source', label: 'Source' },
        { key: 'sessions', label: 'Sessions', align: 'right' },
        { key: 'users', label: 'Users', align: 'right' },
      ],
      tableData: gaSources.slice(0, 10).map(s => ({
        source: s.source, sessions: s.sessions ?? 0, users: s.users ?? 0,
      })) as unknown as Array<Record<string, unknown>>,
    };
  }

  // YT data
  const ytPosts = filterIncludesPlatform(selectedPlatform, 'youtube')
    ? allPosts.filter(p => p.platform === 'youtube' && p.title) : [];
  if (ytPosts.length > 0) {
    map['table-yt-videos'] = {
      tableColumns: [
        { key: 'title', label: 'Video' },
        { key: 'views', label: 'Views', align: 'right' },
        { key: 'likes', label: 'Likes', align: 'right' },
        { key: 'comments', label: 'Comments', align: 'right' },
      ],
      tableData: ytPosts.slice(0, 10).map(v => ({
        title: v.title, views: v.views ?? v.video_views ?? 0, likes: v.likes ?? 0, comments: v.comments ?? 0,
      })) as unknown as Array<Record<string, unknown>>,
    };
  }

  // Platform metric widgets
  for (const snapshot of filtered) {
    const prevSnapshot = filteredPrev.find(s => s.platform === snapshot.platform);
    for (const [key, val] of Object.entries(snapshot.metrics_data)) {
      if (typeof val !== 'number') continue;
      const prevVal = prevSnapshot?.metrics_data[key];
      const change = prevVal && prevVal !== 0 ? ((val - prevVal) / prevVal) * 100 : undefined;
      const isCost = key === 'spend' || key === 'cpc' || key === 'cost_per_conversion' || key === 'cpm';
      map[`platform-${snapshot.platform}-${key}`] = { value: val, change, isCost, currSymbol };
    }
  }

  return map;
}

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

  // Widget state
  const [isEditMode, setIsEditMode] = useState(false);
  const [savedWidgetState, setSavedWidgetState] = useState<Record<string, { visible: boolean; type: WidgetType; position: { x: number; y: number; w: number; h: number } }>>({});

  // Load saved widget state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dashboard-widgets-${clientId}`);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, { visible?: boolean; type?: WidgetType; position?: { x?: number; y?: number; w?: number; h?: number } }>;
      const sanitized = Object.fromEntries(
        Object.entries(parsed || {}).map(([widgetId, config]) => [
          widgetId,
          {
            ...(typeof config?.visible === 'boolean' ? { visible: config.visible } : {}),
            ...(typeof config?.type === 'string' ? { type: config.type as WidgetType } : {}),
            ...(config?.position ? { position: config.position } : {}),
          },
        ]),
      ) as Record<string, { visible: boolean; type: WidgetType; position: { x: number; y: number; w: number; h: number } }>;

      setSavedWidgetState(sanitized);
    } catch {
      setSavedWidgetState({});
    }
  }, [clientId]);

  useEffect(() => { setHasAutoDetected(false); }, [clientId]);

  // ─── Data Fetching (unchanged) ───────────────────────────────
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
      supabase.from("platform_connections").select("platform, last_sync_at, last_sync_status, last_error").eq("client_id", clientId).eq("is_connected", true),
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
  const filteredPosts = useMemo(() => (selectedPlatform === "all" ? allPosts : allPosts.filter(p => matchesPlatformFilter(selectedPlatform, p.platform))), [allPosts, selectedPlatform]);

  const kpis = useMemo(() => {
    const totalSpend = filtered.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const totalReach = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const totalClicks = filtered.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0); }, 0);
    const totalEngagement = filtered.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const totalFollowers = Math.max(...filtered.map(s => s.metrics_data.total_followers || 0), 0);
    const totalLinkClicks = filtered.reduce((sum, s) => sum + (s.metrics_data.link_clicks || 0), 0);
    const totalPageViews = filtered.reduce((sum, s) => sum + (s.metrics_data.page_views || s.metrics_data.ga_page_views || 0), 0);
    const totalSessions = filtered.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const totalVideoViews = filtered.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);

    const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
    const prevReach = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
    const prevClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0); }, 0);
    const prevEngagement = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
    const prevLinkClicks = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.link_clicks || 0), 0);
    const prevPageViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.page_views || s.metrics_data.ga_page_views || 0), 0);
    const prevSessions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
    const prevVideoViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);

    const cc = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / prev) * 100 : undefined);

    return [
      ...((selectedPlatform === 'all' || filterIncludesPlatform(selectedPlatform, 'meta_ads') || filterIncludesPlatform(selectedPlatform, 'google_ads')) ? [{ label: "Total Spend", value: totalSpend, change: cc(totalSpend, prevSpend), icon: Banknote, isCost: true, metricKey: "spend" }] : []),
      ...(filterIncludesPlatform(selectedPlatform, 'tiktok') ? [{ label: "Video Views", value: totalVideoViews, change: cc(totalVideoViews, prevVideoViews), icon: Eye, metricKey: "video_views" }] : []),
      { label: "Reach", value: totalReach, change: cc(totalReach, prevReach), icon: Eye, metricKey: "reach" },
      { label: "Clicks", value: totalClicks, change: cc(totalClicks, prevClicks), icon: MousePointerClick, metricKey: "clicks" },
      { label: "Engagement", value: totalEngagement, change: cc(totalEngagement, prevEngagement), icon: MessageCircle, metricKey: "engagement" },
      ...(totalFollowers > 0 ? [{ label: "Followers", value: totalFollowers, change: undefined as number | undefined, icon: Users, metricKey: "total_followers" }] : []),
      ...(totalSessions > 0 ? [{ label: "Sessions", value: totalSessions, change: cc(totalSessions, prevSessions), icon: Activity, metricKey: "sessions" }] : []),
      ...(totalLinkClicks > 0 ? [{ label: "Link Clicks", value: totalLinkClicks, change: cc(totalLinkClicks, prevLinkClicks), icon: MousePointerClick, metricKey: "link_clicks" }] : []),
      ...(totalPageViews > 0 ? [{ label: "Page Views", value: totalPageViews, change: cc(totalPageViews, prevPageViews), icon: Eye, metricKey: "page_views" }] : []),
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
      existing.link_clicks = (existing.link_clicks || 0) + (s.metrics_data.link_clicks || 0);
      existing.page_views = (existing.page_views || 0) + (s.metrics_data.page_views || s.metrics_data.ga_page_views || 0);
      existing.video_views = (existing.video_views || 0) + (s.metrics_data.video_views || 0);
      existing.sessions = (existing.sessions || 0) + (s.metrics_data.sessions || 0);
      monthMap.set(key, existing);
    }
    const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    for (const metricKey of ["spend", "reach", "clicks", "engagement", "total_followers", "link_clicks", "page_views", "video_views", "sessions"]) {
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

  const geoData = useMemo(() => {
    const all: Array<{ lat: number; lng: number; value: number; label: string }> = [];
    for (const s of filtered) { const geo = (s.metrics_data as any)?.geo_data; if (Array.isArray(geo)) all.push(...geo); }
    return all;
  }, [filtered]);

  const lastSyncedAt = useMemo(() => {
    const syncDates = connections.filter(c => c.last_sync_at).map(c => new Date(c.last_sync_at!).getTime());
    return syncDates.length === 0 ? null : new Date(Math.max(...syncDates));
  }, [connections]);

  const hasData = snapshots.length > 0;
  const hasFilteredData = filtered.length > 0;
  const allZeros = hasFilteredData && kpis.every(k => k.value === 0);

  // ─── Widget System ───────────────────────────────────────────
  const gscPosts = useMemo(() => filterIncludesPlatform(selectedPlatform, 'google_search_console') ? allPosts.filter(p => p.platform === 'google_search_console' && (p.query || p.page)) : [], [allPosts, selectedPlatform]);
  const gaPosts = useMemo(() => filterIncludesPlatform(selectedPlatform, 'google_analytics') ? allPosts.filter(p => p.platform === 'google_analytics' && (p.page || p.source)) : [], [allPosts, selectedPlatform]);
  const ytPosts = useMemo(() => filterIncludesPlatform(selectedPlatform, 'youtube') ? allPosts.filter(p => p.platform === 'youtube' && p.title) : [], [allPosts, selectedPlatform]);

  const defaultWidgets = useMemo(() => generateDefaultWidgets(
    kpis,
    spendByPlatform.length > 1,
    engagementStackedData.length > 0,
    impressionsByPlatform.length > 0,
    trendChartData.length > 0,
    filteredPosts.filter(p => p.message || p.caption).length > 0,
    gscPosts.length > 0,
    gaPosts.filter(p => p.page).length > 0,
    gaPosts.filter(p => p.source && !p.page).length > 0,
    ytPosts.length > 0,
    filtered,
    platformConfigs,
  ), [kpis, spendByPlatform, engagementStackedData, impressionsByPlatform, trendChartData, filteredPosts, gscPosts, gaPosts, ytPosts, filtered, platformConfigs]);

  // Merge saved state with defaults
  const widgets = useMemo(() => {
    return defaultWidgets.map((w) => {
      const saved = savedWidgetState[w.id];
      if (!saved) return w;

      const safeType = saved.type && w.compatibleTypes.includes(saved.type) ? saved.type : w.type;
      return {
        ...w,
        visible: typeof saved.visible === 'boolean' ? saved.visible : w.visible,
        type: safeType,
        position: saved.position ? { ...w.position, ...saved.position } : w.position,
      };
    });
  }, [defaultWidgets, savedWidgetState]);

  const widgetDataMap = useMemo(() => buildWidgetDataMap(
    kpis, sparklineMap, currSymbol, spendByPlatform, totalSpend,
    engagementStackedData as unknown as Array<Record<string, unknown>>,
    impressionsByPlatform as unknown as Array<Record<string, unknown>>,
    trendChartData as unknown as Array<Record<string, unknown>>,
    filteredPosts, allPosts, selectedPlatform, filtered, filteredPrev,
  ), [kpis, sparklineMap, currSymbol, spendByPlatform, totalSpend, engagementStackedData, impressionsByPlatform, trendChartData, filteredPosts, allPosts, selectedPlatform, filtered, filteredPrev]);

  const handleWidgetToggle = useCallback((widgetId: string, visible: boolean) => {
    setSavedWidgetState(prev => {
      const existing = prev[widgetId] || {};
      const next = { ...prev, [widgetId]: { ...existing, visible } as any };
      localStorage.setItem(`dashboard-widgets-${clientId}`, JSON.stringify(next));
      return next;
    });
  }, [clientId]);

  const handleWidgetTypeChange = useCallback((widgetId: string, newType: WidgetType) => {
    setSavedWidgetState(prev => {
      const existing = prev[widgetId] || {};
      const next = { ...prev, [widgetId]: { ...existing, type: newType } as any };
      localStorage.setItem(`dashboard-widgets-${clientId}`, JSON.stringify(next));
      return next;
    });
  }, [clientId]);

  const handleLayoutChange = useCallback((updatedWidgets: DashboardWidget[]) => {
    setSavedWidgetState(prev => {
      const next = { ...prev };
      for (const w of updatedWidgets) {
        next[w.id] = { ...(next[w.id] || {}), position: w.position } as any;
      }
      localStorage.setItem(`dashboard-widgets-${clientId}`, JSON.stringify(next));
      return next;
    });
  }, [clientId]);

  const handleResetLayout = useCallback(() => {
    localStorage.removeItem(`dashboard-widgets-${clientId}`);
    setSavedWidgetState({});
    setIsEditMode(false);
    toast.success("Dashboard layout reset to default");
  }, [clientId]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <DashboardHeader
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        availablePlatforms={availablePlatforms}
      />

      {/* Controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Last synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isEditMode ? "default" : "outline"}
            onClick={() => setIsEditMode(!isEditMode)}
            className="gap-2"
          >
            {isEditMode ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {isEditMode ? "Lock Layout" : "Edit Dashboard"}
          </Button>
          <WidgetPanel widgets={widgets} onToggle={handleWidgetToggle} onResetLayout={handleResetLayout} />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-display">AI Analysis</CardTitle>
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

      {/* AI Analysis Dialog with Markdown */}
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
        <>
          {isEditMode && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              <span>Edit mode — drag widgets to rearrange, use the Widgets panel to show/hide, click chart icons to change visualisation type</span>
            </div>
          )}

          <DashboardGrid
            widgets={widgets}
            dataMap={widgetDataMap}
            onLayoutChange={handleLayoutChange}
            onTypeChange={handleWidgetTypeChange}
            isEditMode={isEditMode}
          />

          {/* Audience Map */}
          <AudienceMap geoData={geoData} />

          {/* Demographics Placeholder */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Audience & Demographics
              </CardTitle>
              <p className="text-xs text-muted-foreground">Understanding who your audience is — age, location, and interests</p>
            </CardHeader>
            <CardContent className="py-8 text-center space-y-2">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Audience insights coming soon</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ClientDashboard;
