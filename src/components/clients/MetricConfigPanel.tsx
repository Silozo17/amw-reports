import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Undo2 } from 'lucide-react';
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

interface LocalPlatformState {
  isEnabled: boolean;
  enabledMetrics: string[];
}

const MetricConfigPanel = ({ clientId, connectedPlatforms }: MetricConfigPanelProps) => {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [defaults, setDefaults] = useState<MetricDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local draft state for batch editing
  const [localState, setLocalState] = useState<Map<PlatformType, LocalPlatformState>>(new Map());

  const fetchData = useCallback(async () => {
    const [configRes, defaultsRes] = await Promise.all([
      supabase.from('client_platform_config').select('*').eq('client_id', clientId),
      supabase.from('metric_defaults').select('*'),
    ]);
    const fetchedConfigs = (configRes.data as PlatformConfig[]) ?? [];
    const fetchedDefaults = (defaultsRes.data as MetricDefault[]) ?? [];
    setConfigs(fetchedConfigs);
    setDefaults(fetchedDefaults);
    // Initialise local state from saved configs
    initLocalState(fetchedConfigs, fetchedDefaults);
    setIsLoading(false);
  }, [clientId]);

  const initLocalState = (savedConfigs: PlatformConfig[], savedDefaults: MetricDefault[]) => {
    const map = new Map<PlatformType, LocalPlatformState>();
    for (const platform of connectedPlatforms) {
      const config = savedConfigs.find(c => c.platform === platform);
      const def = savedDefaults.find(d => d.platform === platform);
      map.set(platform, {
        isEnabled: config?.is_enabled ?? true,
        enabledMetrics: config?.enabled_metrics ?? def?.default_metrics ?? [],
      });
    }
    setLocalState(map);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    for (const platform of connectedPlatforms) {
      const local = localState.get(platform);
      if (!local) continue;
      const config = configs.find(c => c.platform === platform);
      const def = defaults.find(d => d.platform === platform);

      const savedEnabled = config?.is_enabled ?? true;
      const savedMetrics = config?.enabled_metrics ?? def?.default_metrics ?? [];

      if (local.isEnabled !== savedEnabled) return true;
      if (local.enabledMetrics.length !== savedMetrics.length) return true;
      const sortedLocal = [...local.enabledMetrics].sort();
      const sortedSaved = [...savedMetrics].sort();
      if (sortedLocal.some((m, i) => m !== sortedSaved[i])) return true;
    }
    return false;
  }, [localState, configs, defaults, connectedPlatforms]);

  const togglePlatform = (platform: PlatformType, enabled: boolean) => {
    setLocalState(prev => {
      const next = new Map(prev);
      const current = next.get(platform);
      if (current) {
        next.set(platform, { ...current, isEnabled: enabled });
      }
      return next;
    });
  };

  const toggleMetric = (platform: PlatformType, metric: string, enabled: boolean) => {
    setLocalState(prev => {
      const next = new Map(prev);
      const current = next.get(platform);
      if (current) {
        const newMetrics = enabled
          ? [...new Set([...current.enabledMetrics, metric])]
          : current.enabledMetrics.filter(m => m !== metric);
        next.set(platform, { ...current, enabledMetrics: newMetrics });
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const platform of connectedPlatforms) {
        const local = localState.get(platform);
        if (!local) continue;

        const existingConfig = configs.find(c => c.platform === platform);

        if (existingConfig) {
          const { error } = await supabase.from('client_platform_config')
            .update({ is_enabled: local.isEnabled, enabled_metrics: local.enabledMetrics })
            .eq('id', existingConfig.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('client_platform_config')
            .insert({
              client_id: clientId,
              platform,
              is_enabled: local.isEnabled,
              enabled_metrics: local.enabledMetrics,
            });
          if (error) throw error;
        }
      }

      toast.success('Metric configuration saved');
      await fetchData();
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    initLocalState(configs, defaults);
    toast.info('Changes discarded');
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
      {/* Save/Discard bar */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {connectedPlatforms.map(platform => {
        const local = localState.get(platform);
        const def = defaults.find(d => d.platform === platform);
        const availableMetrics = def?.available_metrics ?? Object.keys(METRIC_LABELS);
        const enabledMetrics = local?.enabledMetrics ?? [];
        const isEnabled = local?.isEnabled ?? true;

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
