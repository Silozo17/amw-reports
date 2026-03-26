import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_LABELS, PLATFORM_LOGOS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from '@/types/database';
import { METRIC_EXPLANATIONS } from '@/types/metrics';
import type { PlatformType } from '@/types/database';
import { cn } from '@/lib/utils';

interface PortalOrg {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
}

interface PortalClient {
  id: string;
  company_name: string;
  full_name: string;
  logo_url: string | null;
  preferred_currency: string;
  org_id: string;
}

interface SnapshotData {
  platform: PlatformType;
  metrics_data: Record<string, number>;
  top_content?: unknown[];
  report_month: number;
  report_year: number;
}

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const hexToHsl = (hex: string): string | null => {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hue = 0, sat = 0;
    const light = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hue = ((b - r) / d + 2) / 6;
      else hue = ((r - g) / d + 4) / 6;
    }
    return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%`;
  } catch { return null; }
};

const applyBranding = (org: PortalOrg) => {
  const root = document.documentElement;
  if (org.primary_color) {
    const hsl = org.primary_color.startsWith('#') ? hexToHsl(org.primary_color) : org.primary_color;
    if (hsl) root.style.setProperty('--primary', hsl);
  }
  if (org.heading_font) {
    root.style.setProperty('--font-heading', org.heading_font);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.heading_font)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }
  if (org.body_font) {
    root.style.setProperty('--font-body', org.body_font);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(org.body_font)}:wght@300;400;500;600&display=swap`;
    document.head.appendChild(link);
  }
};

const formatMetricValue = (key: string, val: number, currSymbol: string): string => {
  if (key === 'spend' || key === 'cpc' || key === 'cost_per_conversion' || key === 'cost_per_lead' || key === 'cpm') {
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (key === 'ctr' || key === 'engagement_rate' || key === 'conversion_rate' || key === 'audience_growth_rate' || key === 'bounce_rate' || key === 'search_ctr' || key === 'completion_rate') {
    return `${val.toFixed(2)}%`;
  }
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString();
};

const METRIC_LABELS_MAP: Record<string, string> = {
  spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', ctr: 'CTR',
  conversions: 'Conversions', cpc: 'CPC', cpm: 'CPM', reach: 'Reach',
  total_followers: 'Followers', follower_growth: 'Growth', engagement: 'Engagement',
  engagement_rate: 'Eng. Rate', likes: 'Likes', comments: 'Comments', shares: 'Shares',
  video_views: 'Video Views', posts_published: 'Posts', cost_per_conversion: 'Cost/Conv',
  cost_per_lead: 'Cost/Lead', conversion_rate: 'Conv. Rate', leads: 'Leads', saves: 'Saves',
  profile_visits: 'Profile Visits', page_likes: 'Page Likes', page_views: 'Page Views',
  link_clicks: 'Link Clicks', audience_growth_rate: 'Audience Growth',
  sessions: 'Sessions', active_users: 'Active Users', new_users: 'New Users',
  bounce_rate: 'Bounce Rate', subscribers: 'Subscribers', views: 'Views',
  watch_time: 'Watch Time (min)', search_clicks: 'Search Clicks',
  search_impressions: 'Search Impressions', search_ctr: 'Search CTR',
  gbp_views: 'Profile Views', gbp_searches: 'Search Appearances',
  gbp_calls: 'Phone Calls', gbp_direction_requests: 'Direction Requests',
};

const ClientPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotData[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<SnapshotData[]>([]);
  const [period, setPeriod] = useState<{ month: number; year: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | PlatformType>('all');

  useEffect(() => {
    const load = async () => {
      if (!token) { setError('Invalid link'); setIsLoading(false); return; }

      const { data, error: fnErr } = await supabase.functions.invoke('portal-data', {
        body: { token },
      });

      if (fnErr || data?.error) {
        setError(data?.error ?? fnErr?.message ?? 'Failed to load dashboard');
        setIsLoading(false);
        return;
      }

      setClient(data.client);
      setOrg(data.org);
      setSnapshots(data.snapshots ?? []);
      setPrevSnapshots(data.prevSnapshots ?? []);
      setPeriod(data.period);

      if (data.org) applyBranding(data.org);
      setIsLoading(false);
    };

    load();
  }, [token]);

  const currSymbol = useMemo(() => getCurrencySymbol(client?.preferred_currency ?? 'GBP'), [client]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    if (snapshots.length === 0) return [];
    const sum = (key: string) => snapshots.reduce((s, sn) => s + (sn.metrics_data[key] ?? 0), 0);
    const prevSum = (key: string) => prevSnapshots.reduce((s, sn) => s + (sn.metrics_data[key] ?? 0), 0);
    const change = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : undefined;

    const items: Array<{ label: string; value: number; formatted: string; change?: number; isCost?: boolean }> = [];
    const totalSpend = sum('spend');
    const totalImpressions = sum('impressions');
    const totalClicks = sum('clicks');
    const totalEngagement = sum('engagement') + sum('likes') + sum('comments') + sum('shares');

    if (totalSpend > 0) items.push({ label: 'Total Spend', value: totalSpend, formatted: formatMetricValue('spend', totalSpend, currSymbol), change: change(totalSpend, prevSum('spend')), isCost: true });
    if (totalImpressions > 0) items.push({ label: 'Impressions', value: totalImpressions, formatted: formatMetricValue('impressions', totalImpressions, currSymbol), change: change(totalImpressions, prevSum('impressions')) });
    if (totalClicks > 0) items.push({ label: 'Clicks', value: totalClicks, formatted: formatMetricValue('clicks', totalClicks, currSymbol), change: change(totalClicks, prevSum('clicks')) });
    if (totalEngagement > 0) {
      const prevEng = prevSum('engagement') + prevSum('likes') + prevSum('comments') + prevSum('shares');
      items.push({ label: 'Engagement', value: totalEngagement, formatted: formatMetricValue('engagement', totalEngagement, currSymbol), change: change(totalEngagement, prevEng) });
    }
    return items;
  }, [snapshots, prevSnapshots, currSymbol]);

  const filteredSnapshots = useMemo(() => {
    if (selectedPlatform === 'all') return snapshots;
    return snapshots.filter(s => s.platform === selectedPlatform);
  }, [snapshots, selectedPlatform]);
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !client || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-display text-foreground mb-2">Dashboard Unavailable</h1>
          <p className="text-muted-foreground">{error ?? 'Something went wrong.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Portal header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url && (
              <img src={org.logo_url} alt={org.name} className="h-8 w-auto object-contain" />
            )}
            <span className="font-display text-lg text-foreground">{org.name}</span>
          </div>
          <div className="flex items-center gap-3">
            {client.logo_url && (
              <img src={client.logo_url} alt={client.company_name} className="h-8 w-8 rounded-lg object-contain border bg-muted" />
            )}
            <span className="text-sm text-muted-foreground font-body">{client.company_name}</span>
          </div>
        </div>
      </header>

      {/* Dashboard content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {period && (
          <h2 className="text-xl font-display text-foreground">
            {MONTH_NAMES[period.month]} {period.year} Performance
          </h2>
        )}

        {/* KPI Cards */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(kpi => {
              const isGood = kpi.change !== undefined ? (kpi.isCost ? kpi.change < 0 : kpi.change > 0) : undefined;
              return (
                <Card key={kpi.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-body uppercase tracking-wide">{kpi.label}</p>
                    <p className="text-2xl font-display mt-1">{kpi.formatted}</p>
                    {kpi.change !== undefined && (
                      <div className={cn('flex items-center gap-1 mt-1 text-xs', isGood ? 'text-green-600' : 'text-orange-500')}>
                        {kpi.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{Math.abs(kpi.change).toFixed(1)}% vs last month</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Platform Filter */}
        {snapshots.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedPlatform === 'all' ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setSelectedPlatform('all')}
            >
              All Platforms
            </Badge>
            {snapshots.map(s => (
              <Badge
                key={s.platform}
                variant={selectedPlatform === s.platform ? 'default' : 'outline'}
                className="cursor-pointer select-none flex items-center gap-1.5"
                onClick={() => setSelectedPlatform(s.platform)}
              >
                {PLATFORM_LOGOS[s.platform] && (
                  <img src={PLATFORM_LOGOS[s.platform]} alt="" className="h-3.5 w-3.5 object-contain" />
                )}
                {PLATFORM_LABELS[s.platform]}
              </Badge>
            ))}
          </div>
        )}

        {/* Platform Sections */}
        {filteredSnapshots.map(snapshot => {
          const platform = snapshot.platform;
          const isOrganic = ORGANIC_PLATFORMS.has(platform);
          const prevSnapshot = prevSnapshots.find(s => s.platform === platform);
          const metrics = Object.entries(snapshot.metrics_data)
            .filter(([key, val]) => typeof val === 'number' && val !== 0 && !HIDDEN_METRICS.has(key) && !(isOrganic && AD_METRICS.has(key)));

          if (metrics.length === 0) return null;

          return (
            <Card key={platform}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {PLATFORM_LOGOS[platform] && (
                    <img src={PLATFORM_LOGOS[platform]} alt="" className="h-5 w-5 object-contain" />
                  )}
                  <CardTitle className="font-display text-lg">{PLATFORM_LABELS[platform]}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[280px] px-6 pb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {metrics.map(([key, val]) => {
                      const prevVal = prevSnapshot?.metrics_data[key];
                      const change = prevVal && prevVal !== 0 ? ((val - prevVal) / prevVal) * 100 : undefined;
                      const isCost = key === 'spend' || key === 'cpc' || key === 'cost_per_conversion' || key === 'cost_per_lead' || key === 'cpm';
                      const isGood = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;

                      return (
                        <div key={key} className="rounded-lg bg-muted/50 p-3 border">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
                            {METRIC_LABELS_MAP[key] ?? key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-lg font-semibold mt-1">{formatMetricValue(key, val, currSymbol)}</p>
                          {change !== undefined && (
                            <div className={cn('flex items-center gap-1 mt-1 text-xs', isGood ? 'text-green-600' : 'text-orange-500')}>
                              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              <span>{Math.abs(change).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}

        {filteredSnapshots.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Minus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No data available for this period.</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Powered by {org.name}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;
