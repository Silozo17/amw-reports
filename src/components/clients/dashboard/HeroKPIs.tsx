import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { METRIC_EXPLANATIONS } from '@/types/metrics';
import {
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import MetricTooltip from '@/components/clients/MetricTooltip';
import { PLATFORM_LOGOS, PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HeroKPI {
  label: string;
  value: number;
  change?: number;
  isCost?: boolean;
  isPercentage?: boolean;
  isDecimal?: boolean;
  metricKey: string;
  icon: React.ElementType;
  platforms?: PlatformType[];
}

interface HeroKPIsProps {
  kpis: HeroKPI[];
  currSymbol: string;
  sparklineMap: Record<string, Array<{ v: number; name: string }>>;
}

const ACCENT_COLORS: Record<string, string> = {
  spend: 'hsl(var(--amw-purple))',
  reach: 'hsl(var(--amw-blue))',
  clicks: 'hsl(var(--amw-orange))',
  engagement: 'hsl(var(--amw-green))',
  total_followers: 'hsl(var(--amw-blue))',
  sessions: 'hsl(var(--amw-purple))',
  link_clicks: 'hsl(var(--amw-orange))',
  page_views: 'hsl(var(--amw-blue))',
  video_views: 'hsl(var(--amw-green))',
  search_impressions: 'hsl(var(--amw-purple))',
  search_clicks: 'hsl(var(--amw-orange))',
  search_ctr: 'hsl(var(--amw-green))',
  search_position: 'hsl(var(--amw-blue))',
};

const formatValue = (val: number, isCost: boolean, currSymbol: string, isPercentage?: boolean, isDecimal?: boolean): string => {
  if (isPercentage) return `${val.toFixed(1)}%`;
  if (isDecimal) return val.toFixed(1);
  if (isCost)
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
};

const HeroKPICard = ({
  kpi,
  currSymbol,
  sparkline,
}: {
  kpi: HeroKPI;
  currSymbol: string;
  sparkline: Array<{ v: number; name: string }>;
}) => {
  const animatedValue = useAnimatedCounter(kpi.value);
  const isCost = kpi.isCost ?? false;
  const change = kpi.change;
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const accentColor = ACCENT_COLORS[kpi.metricKey] ?? 'hsl(var(--primary))';
  const Icon = kpi.icon;

  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
      {/* Color accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-lg" style={{ backgroundColor: accentColor }} />

      {/* Background sparkline */}
      {sparkline.length > 1 && (
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`hero-bg-${kpi.metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={1} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="none" fill={`url(#hero-bg-${kpi.metricKey})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <CardContent className="p-5 pl-6 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Icon className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">
            {kpi.label}
          </span>
          <MetricTooltip metricKey={kpi.metricKey} />
          {kpi.platforms && kpi.platforms.length > 0 && (
            <div className="flex items-center gap-0.5 ml-auto">
              <TooltipProvider delayDuration={200}>
                {kpi.platforms.slice(0, 5).map((p) => (
                  <Tooltip key={p}>
                    <TooltipTrigger asChild>
                      <img
                        src={PLATFORM_LOGOS[p]}
                        alt={PLATFORM_LABELS[p]}
                        className="h-4 w-4 object-contain"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {PLATFORM_LABELS[p]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          )}
        </div>

        <p className="text-3xl font-bold font-body tabular-nums leading-none mb-2">
          {formatValue(animatedValue, isCost, currSymbol, kpi.isPercentage, kpi.isDecimal)}
        </p>

        {change !== undefined && (
          <div
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              isPositive === true ? 'bg-accent/10 text-accent' :
              isPositive === false ? 'bg-destructive/10 text-destructive' :
              'bg-muted text-muted-foreground',
            )}
          >
            {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}% vs last month
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const HeroKPIs = ({ kpis, currSymbol, sparklineMap }: HeroKPIsProps) => {
  if (kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.slice(0, 8).map((kpi) => (
        <HeroKPICard
          key={kpi.metricKey}
          kpi={kpi}
          currSymbol={currSymbol}
          sparkline={sparklineMap[kpi.metricKey] ?? []}
        />
      ))}
    </div>
  );
};

export default HeroKPIs;
