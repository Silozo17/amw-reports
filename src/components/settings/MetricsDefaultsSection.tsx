import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PLATFORM_LABELS, METRIC_LABELS, PLATFORM_AVAILABLE_METRICS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import { toast } from 'sonner';

interface MetricDefault {
  id: string;
  platform: PlatformType;
  available_metrics: string[];
  default_metrics: string[];
}

const ALL_PLATFORMS: PlatformType[] = [
  'google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'tiktok_ads', 'linkedin',
  'google_search_console', 'google_analytics', 'google_business_profile', 'youtube', 'pinterest',
];

const MetricsDefaultsSection = () => {
  const [metricDefaults, setMetricDefaults] = useState<MetricDefault[]>([]);

  const fetchDefaults = async () => {
    const { data } = await supabase.from('metric_defaults').select('*');
    setMetricDefaults((data as MetricDefault[]) ?? []);
  };

  useEffect(() => {
    fetchDefaults();
  }, []);

  const initDefaults = async (platform: PlatformType) => {
    const available = PLATFORM_AVAILABLE_METRICS[platform] ?? [];
    const { error } = await supabase.from('metric_defaults').insert({
      platform,
      available_metrics: available,
      default_metrics: available.slice(0, 8),
    });
    if (error) toast.error('Failed to create defaults');
    else fetchDefaults();
  };

  const toggleDefaultMetric = async (platform: PlatformType, metric: string, enabled: boolean) => {
    const def = metricDefaults.find(d => d.platform === platform);
    if (!def) return;

    const newDefaults = enabled
      ? [...def.default_metrics, metric]
      : def.default_metrics.filter(m => m !== metric);

    const { error } = await supabase.from('metric_defaults')
      .update({ default_metrics: newDefaults })
      .eq('id', def.id);

    if (error) toast.error('Failed to update');
    else fetchDefaults();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Platform Metric Defaults</CardTitle>
        <p className="text-sm text-muted-foreground">Configure default metrics for each platform. Clients inherit these unless overridden.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {ALL_PLATFORMS.map(platform => {
          const def = metricDefaults.find(d => d.platform === platform);
          const availableMetrics = PLATFORM_AVAILABLE_METRICS[platform] ?? [];
          return (
            <div key={platform} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-body font-semibold">{PLATFORM_LABELS[platform]}</h3>
                {!def && (
                  <Button size="sm" variant="outline" onClick={() => initDefaults(platform)}>
                    Initialize Defaults
                  </Button>
                )}
              </div>
              {def && (
                <div className="flex flex-wrap gap-2">
                  {availableMetrics.map(metric => {
                    const isOn = def.default_metrics.includes(metric);
                    return (
                      <Badge
                        key={metric}
                        variant={isOn ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors text-xs"
                        onClick={() => toggleDefaultMetric(platform, metric, !isOn)}
                      >
                        {METRIC_LABELS[metric] ?? metric}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default MetricsDefaultsSection;
