import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLATFORM_LABELS, METRIC_LABELS, PLATFORM_LOGOS, getCurrencySymbol, HIDDEN_METRICS, AD_METRICS, ORGANIC_PLATFORMS } from '@/types/database';
import type { PlatformType, JobStatus } from '@/types/database';
import MetricTooltip from './MetricTooltip';
import { TrendingUp, TrendingDown, Minus, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PlatformMetricsCardProps {
  platform: PlatformType;
  metrics: Record<string, number>;
  prevMetrics?: Record<string, number>;
  currencyCode?: string;
  enabledMetrics?: string[];
  syncStatus?: JobStatus | null;
  lastError?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-accent',
  failed: 'bg-destructive',
  pending: 'bg-amber-500',
  running: 'bg-amber-500',
  partial: 'bg-amber-500',
};

const formatValue = (key: string, value: number, currencySymbol: string): string => {
  if (key === 'spend' || key === 'cpc' || key === 'cost_per_conversion' || key === 'cpm') {
    return `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (key === 'ctr' || key === 'engagement_rate' || key === 'conversion_rate' || key === 'audience_growth_rate') {
    return `${value.toFixed(2)}%`;
  }
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value % 1 !== 0 ? value.toFixed(2) : value.toLocaleString();
};

const PlatformMetricsCard = ({ platform, metrics, prevMetrics, currencyCode = 'GBP', enabledMetrics, syncStatus, lastError }: PlatformMetricsCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const isOrganic = ORGANIC_PLATFORMS.has(platform);

  const metricEntries = Object.entries(metrics).filter(
    ([key, val]) =>
      typeof val === 'number' &&
      !HIDDEN_METRICS.has(key) &&
      !(isOrganic && AD_METRICS.has(key)) &&
      (enabledMetrics ? enabledMetrics.includes(key) : true)
  );
  const currencySymbol = getCurrencySymbol(currencyCode);
  const logo = PLATFORM_LOGOS[platform];
  const statusColor = syncStatus ? STATUS_COLORS[syncStatus] ?? '' : '';

  if (metricEntries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-base flex items-center gap-2">
            {logo && <img src={logo} alt="" className="h-6 w-6 object-contain" />}
            {PLATFORM_LABELS[platform] || platform}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            No metrics enabled for this platform. Configure metrics in the Metrics tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-4 cursor-pointer select-none hover:bg-muted/30 transition-colors">
            <CardTitle className="font-display text-base flex items-center gap-2">
              {logo && <img src={logo} alt="" className="h-6 w-6 object-contain" />}
              {PLATFORM_LABELS[platform] || platform}
              {statusColor && (
                <span className={cn('h-2 w-2 rounded-full', statusColor)} title={`Sync: ${syncStatus}`} />
              )}
              <ChevronDown className={cn('h-4 w-4 ml-auto text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {syncStatus === 'failed' && lastError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-4">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Data sync failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lastError}. Try reconnecting this platform.</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {metricEntries.map(([key, value]) => {
                const prevValue = prevMetrics?.[key];
                const change = prevValue && prevValue !== 0
                  ? ((value - prevValue) / prevValue) * 100
                  : undefined;

                const isCostMetric = key === 'spend' || key === 'cpc' || key === 'cost_per_conversion' || key === 'cpm';
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
                    <p className="text-xl font-bold font-display">{formatValue(key, value, currencySymbol)}</p>
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PlatformMetricsCard;
