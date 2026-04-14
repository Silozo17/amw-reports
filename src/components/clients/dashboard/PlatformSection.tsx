import { Card, CardContent } from '@/components/ui/card';
import { HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS, METRIC_LABELS } from '@/types/database';
import { METRIC_EXPLANATIONS } from '@/types/metrics';
import { useChartColors } from '@/hooks/useChartColors';

import type { PlatformSectionProps } from './platforms/shared/types';
import { PLATFORM_KEY_METRICS } from './platforms/shared/constants';
import MetricCard from './platforms/shared/MetricCard';
import PlatformHeader from './platforms/shared/PlatformHeader';
import TrendChart from './platforms/shared/TrendChart';
import TopContentSection from './platforms/shared/TopContentSection';
import { GscTrendChart, GscRawDataExtras } from './platforms/GoogleSearchConsoleExtras';
import MetaAdsExtras from './platforms/MetaAdsExtras';
import GoogleAdsExtras from './platforms/GoogleAdsExtras';
import LinkedInAdsExtras from './platforms/LinkedInAdsExtras';
import GoogleAnalyticsExtras from './platforms/GoogleAnalyticsExtras';

// ─── Platform Section ──────────────────────────────────────────
const PlatformSection = ({
  platform,
  metricsData,
  prevMetricsData,
  connection,
  topContent,
  trendData,
  currSymbol,
  enabledMetrics,
  reportMonth,
  reportYear,
  rawData,
}: PlatformSectionProps) => {
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
  const tc = topContent ?? [];
  const socialPosts = tc.filter(p => p.message || p.caption || p.full_picture || p.permalink_url || p.likes || p.comments || p.shares);
  const gscQueries = tc.filter(p => p.type === 'query' || (p.query && platform === 'google_search_console'));
  const gscPages = tc.filter(p => p.type === 'page' && platform === 'google_search_console');
  const gaPages = tc.filter(p => p.page && !p.query && platform === 'google_analytics');
  const gaSources = tc.filter(p => p.source);
  const ytVideos = tc.filter(p => p.title);
  const gbpReviews = tc.filter(p => p.type === 'review');
  const gbpKeywords = tc.filter(p => p.type === 'keyword');

  // Determine a chart to show
  const isAdPlatform = platform === 'google_ads' || platform === 'meta_ads';
  const chartMetricKey = isAdPlatform ? 'spend' : platform === 'google_analytics' ? 'sessions' : platform === 'google_search_console' ? 'search_clicks' : platform === 'youtube' ? 'views' : 'engagement';
  const hasChartData = trendData && trendData.length > 1 && trendData.some(d => (d[chartMetricKey] as number) > 0);
  const chartLabel = METRIC_LABELS[chartMetricKey] ?? chartMetricKey;

  if (allMetricKeys.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <PlatformHeader platform={platform} syncStatus={syncStatus} lastSyncAt={lastSyncAt} />

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
        {platform === 'google_search_console' && trendData && trendData.length > 1
          ? <GscTrendChart trendData={trendData} currSymbol={currSymbol} />
          : hasChartData && trendData && (
              <TrendChart trendData={trendData} chartMetricKey={chartMetricKey} chartLabel={chartLabel} platform={platform} />
            )
        }

        {/* Top Content */}
        <TopContentSection
          platform={platform}
          socialPosts={socialPosts}
          gscQueries={gscQueries}
          gscPages={gscPages}
          gaPages={gaPages}
          gaSources={gaSources}
          ytVideos={ytVideos}
          gbpReviews={gbpReviews}
          gbpKeywords={gbpKeywords}
        />

        {/* Platform-specific extras */}
        {platform === 'meta_ads' && rawData && (
          <MetaAdsExtras rawData={rawData} currSymbol={currSymbol} />
        )}
        {platform === 'google_ads' && rawData && (
          <GoogleAdsExtras rawData={rawData} currSymbol={currSymbol} />
        )}
        {platform === 'linkedin_ads' && rawData && (
          <LinkedInAdsExtras rawData={rawData} currSymbol={currSymbol} />
        )}
        {platform === 'google_analytics' && rawData && (
          <GoogleAnalyticsExtras rawData={rawData} />
        )}
        {platform === 'google_search_console' && rawData && (
          <GscRawDataExtras rawData={rawData} />
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformSection;
