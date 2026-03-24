import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLATFORM_LABELS, METRIC_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import MetricTooltip from './MetricTooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformMetricsCardProps {
  platform: PlatformType;
  metrics: Record<string, number>;
  prevMetrics?: Record<string, number>;
}

const formatValue = (key: string, value: number): string => {
  if (key === 'spend' || key === 'cpc' || key === 'cost_per_conversion') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (key === 'ctr' || key === 'engagement_rate' || key === 'conversion_rate' || key === 'audience_growth_rate') {
    return `${value.toFixed(2)}%`;
  }
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value % 1 !== 0 ? value.toFixed(2) : value.toLocaleString();
};

const PLATFORM_ICONS: Record<string, string> = {
  google_ads: '📊',
  meta_ads: '📱',
  facebook: '📘',
  instagram: '📸',
  tiktok: '🎵',
  linkedin: '💼',
};

const PlatformMetricsCard = ({ platform, metrics, prevMetrics }: PlatformMetricsCardProps) => {
  const metricEntries = Object.entries(metrics).filter(
    ([_, val]) => typeof val === 'number'
  );

  if (metricEntries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <span className="text-xl">{PLATFORM_ICONS[platform] || '📈'}</span>
          {PLATFORM_LABELS[platform] || platform}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {metricEntries.map(([key, value]) => {
            const prevValue = prevMetrics?.[key];
            const change = prevValue && prevValue !== 0
              ? ((value - prevValue) / prevValue) * 100
              : undefined;

            const isCostMetric = key === 'spend' || key === 'cpc' || key === 'cost_per_conversion';
            const isPositive = change !== undefined
              ? isCostMetric ? change < 0 : change > 0
              : undefined;

            return (
              <div key={key} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-muted-foreground truncate uppercase tracking-wider font-medium">
                    {METRIC_LABELS[key] || key}
                  </p>
                  <MetricTooltip metricKey={key} />
                </div>
                <p className="text-xl font-bold font-display">{formatValue(key, value)}</p>
                {change !== undefined ? (
                  <div className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    isPositive === true ? 'text-accent' :
                    isPositive === false ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {change > 0 ? <TrendingUp className="h-3 w-3" /> :
                     change < 0 ? <TrendingDown className="h-3 w-3" /> :
                     <Minus className="h-3 w-3" />}
                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)}% MoM</span>
                  </div>
                ) : value === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 italic">No data</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformMetricsCard;
