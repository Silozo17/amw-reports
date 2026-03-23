import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PLATFORM_LABELS, METRIC_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';

interface PlatformConfig {
  id: string;
  client_id: string;
  platform: PlatformType;
  is_enabled: boolean;
  enabled_metrics: string[];
  section_order: number;
}

interface MetricDefault {
  platform: PlatformType;
  available_metrics: string[];
  default_metrics: string[];
}

interface MetricConfigPanelProps {
  clientId: string;
  connectedPlatforms: PlatformType[];
}

const MetricConfigPanel = ({ clientId, connectedPlatforms }: MetricConfigPanelProps) => {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [defaults, setDefaults] = useState<MetricDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const [configRes, defaultsRes] = await Promise.all([
      supabase.from('client_platform_config').select('*').eq('client_id', clientId),
      supabase.from('metric_defaults').select('*'),
    ]);
    setConfigs((configRes.data as PlatformConfig[]) ?? []);
    setDefaults((defaultsRes.data as MetricDefault[]) ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const getConfig = (platform: PlatformType): PlatformConfig | undefined =>
    configs.find(c => c.platform === platform);

  const getDefault = (platform: PlatformType): MetricDefault | undefined =>
    defaults.find(d => d.platform === platform);

  const ensureConfig = async (platform: PlatformType): Promise<string | null> => {
    const existing = getConfig(platform);
    if (existing) return existing.id;

    const def = getDefault(platform);
    const { data, error } = await supabase.from('client_platform_config').insert({
      client_id: clientId,
      platform,
      is_enabled: true,
      enabled_metrics: def?.default_metrics ?? [],
    }).select('id').single();

    if (error) {
      toast.error('Failed to create config');
      return null;
    }
    await fetchData();
    return data.id;
  };

  const togglePlatform = async (platform: PlatformType, enabled: boolean) => {
    const configId = await ensureConfig(platform);
    if (!configId) return;

    const { error } = await supabase.from('client_platform_config')
      .update({ is_enabled: enabled })
      .eq('id', configId);

    if (error) toast.error('Failed to update');
    else await fetchData();
  };

  const toggleMetric = async (platform: PlatformType, metric: string, enabled: boolean) => {
    const configId = await ensureConfig(platform);
    if (!configId) return;

    const config = configs.find(c => c.id === configId);
    const currentMetrics = config?.enabled_metrics ?? [];
    const newMetrics = enabled
      ? [...currentMetrics, metric]
      : currentMetrics.filter(m => m !== metric);

    const { error } = await supabase.from('client_platform_config')
      .update({ enabled_metrics: newMetrics })
      .eq('id', configId);

    if (error) toast.error('Failed to update metric');
    else await fetchData();
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Loading metric config...</div>;
  }

  if (connectedPlatforms.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Connect platforms first to configure metrics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {connectedPlatforms.map(platform => {
        const config = getConfig(platform);
        const def = getDefault(platform);
        const availableMetrics = def?.available_metrics ?? Object.keys(METRIC_LABELS);
        const enabledMetrics = config?.enabled_metrics ?? def?.default_metrics ?? [];
        const isEnabled = config?.is_enabled ?? true;

        return (
          <Card key={platform}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display">{PLATFORM_LABELS[platform]}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{isEnabled ? 'Included' : 'Excluded'}</span>
                  <Switch checked={isEnabled} onCheckedChange={v => togglePlatform(platform, v)} />
                </div>
              </div>
            </CardHeader>
            {isEnabled && (
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availableMetrics.map(metric => {
                    const isOn = enabledMetrics.includes(metric);
                    return (
                      <Badge
                        key={metric}
                        variant={isOn ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors text-xs"
                        onClick={() => toggleMetric(platform, metric, !isOn)}
                      >
                        {METRIC_LABELS[metric] ?? metric}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default MetricConfigPanel;
