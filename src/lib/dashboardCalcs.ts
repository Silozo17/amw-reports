import {
  Banknote, Eye, MousePointerClick, MessageCircle, Users,
  Activity, Target, FileText, Link, Search, Crosshair, Hash, PenSquare,
} from "lucide-react";
import { PLATFORM_LABELS } from "@/types/database";
import type { PlatformType } from "@/types/database";
import type { SnapshotData, KpiItem } from "@/hooks/useClientDashboard";
import type { PlatformFilter } from "@/components/clients/DashboardHeader";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cc = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / prev) * 100 : undefined);

const filterIncludesPlatform = (filter: PlatformFilter, platform: PlatformType): boolean => {
  if (filter === "all") return true;
  if (Array.isArray(filter)) return filter.includes(platform);
  return false;
};

export function computeKpis(
  filtered: SnapshotData[],
  filteredPrev: SnapshotData[],
  selectedPlatform: PlatformFilter
): KpiItem[] {
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
  const totalPostsPublished = filtered.reduce((sum, s) => sum + (s.metrics_data.posts_published || 0), 0);

  const prevSpend = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.spend || 0), 0);
  const prevReach = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; if (s.platform === 'facebook') return sum + (m.views || 0); return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0); }, 0);
  const prevClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0); }, 0);
  const prevEngagement = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return m.engagement ? sum + m.engagement : sum + (m.likes || 0) + (m.comments || 0) + (m.shares || 0); }, 0);
  const prevSessions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.sessions || 0), 0);
  const prevVideoViews = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.video_views || 0), 0);
  const prevConversions = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.conversions || 0), 0);
  const prevPageViews = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.ga_page_views || 0) + (m.page_views || 0) + (m.gbp_views || 0); }, 0);
  const prevWebsiteClicks = filteredPrev.reduce((sum, s) => { const m = s.metrics_data; return sum + (m.website_clicks || 0) + (m.gbp_website_clicks || 0) + (m.link_clicks || 0); }, 0);
  const prevPostsPublished = filteredPrev.reduce((sum, s) => sum + (s.metrics_data.posts_published || 0), 0);

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
  const postsPublishedPlatforms = platformsFor(m => m.posts_published || 0);

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
}

export function computeSparklines(
  trendData: SnapshotData[],
  selectedPlatform: PlatformFilter,
  matchesPlatformFilter: (filter: PlatformFilter, platform: PlatformType) => boolean
): Record<string, Array<{ v: number; name: string }>> {
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
    existing.search_impressions = (existing.search_impressions || 0) + (s.metrics_data.search_impressions || 0);
    existing.search_clicks = (existing.search_clicks || 0) + (s.metrics_data.search_clicks || 0);
    monthMap.set(key, existing);
  }
  const sortedFinal = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  for (const metricKey of ["spend", "reach", "clicks", "engagement", "total_followers", "video_views", "sessions", "search_impressions", "search_clicks"]) {
    map[metricKey] = sortedFinal.map(([key, data]) => { const [y, m] = key.split("-"); return { v: data[metricKey] || 0, name: `${MONTH_NAMES[parseInt(m)]} ${y.slice(2)}` }; });
  }
  return map;
}
