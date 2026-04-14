import { cn } from '@/lib/utils';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import {
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import MetricTooltip from '@/components/clients/MetricTooltip';
import { PLATFORM_LOGOS, PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import useTilt from '@/hooks/useTilt';

/* ─── Types ─── */

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

/* ─── Constants ─── */

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
  posts_published: 'hsl(var(--amw-green))',
  gbp_calls: 'hsl(var(--amw-blue))',
  gbp_direction_requests: 'hsl(var(--amw-orange))',
  gbp_average_rating: 'hsl(var(--amw-orange))',
  leads: 'hsl(var(--amw-purple))',
  website_clicks: 'hsl(var(--amw-orange))',
};



/* ─── Helpers ─── */

const formatValue = (val: number, isCost: boolean, currSymbol: string, isPercentage?: boolean, isDecimal?: boolean): string => {
  if (isPercentage) return `${val.toFixed(1)}%`;
  if (isDecimal) return val.toFixed(1);
  if (isCost)
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
};

/* ─── Metric-Specific Visuals ─── */

const MetricVisual = ({ metricKey, value, accentColor, featured }: { metricKey: string; value: number; accentColor: string; featured: boolean }) => {
  const size = featured ? 72 : 52;

  switch (metricKey) {
    case 'spend': {
      const pct = Math.min(value / 10000, 1);
      const r = size / 2 - 4;
      const circumHalf = Math.PI * r;
      return (
        <svg width={size} height={size / 2 + 4} className="opacity-80">
          <path
            d={`M 4 ${size / 2} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2}`}
            fill="none"
            stroke={accentColor}
            strokeWidth={3.5}
            strokeOpacity={0.15}
          />
          <path
            d={`M 4 ${size / 2} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2}`}
            fill="none"
            stroke={accentColor}
            strokeWidth={3.5}
            strokeDasharray={`${circumHalf}`}
            strokeDashoffset={circumHalf * (1 - pct)}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      );
    }

    case 'video_views': {
      const bars = [0.5, 0.8, 0.6];
      const barW = featured ? 10 : 7;
      const maxH = featured ? 40 : 28;
      return (
        <div className="flex items-end gap-1 opacity-80">
          {bars.map((h, i) => (
            <div
              key={i}
              className="rounded-sm animate-[grow-bar_0.8s_ease-out_both]"
              style={{
                width: barW,
                height: maxH * h,
                backgroundColor: accentColor,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      );
    }

    case 'reach':
      return (
        <div className="relative opacity-70" style={{ width: size, height: size }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-2 animate-ring-expand"
              style={{
                borderColor: accentColor,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>
      );

    case 'clicks':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="opacity-80">
          <path d="M20 32 L20 8" stroke={accentColor} strokeWidth={2.5} strokeLinecap="round" />
          <path d="M12 16 L20 8 L28 16" stroke={accentColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 32 L20 18" stroke={accentColor} strokeWidth={1.5} strokeOpacity={0.3} strokeLinecap="round" />
        </svg>
      );

    case 'engagement':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="opacity-80 animate-[pulse_2s_ease-in-out_infinite]">
          <path
            d="M20 35 C12 28 4 22 4 15 C4 9 8 5 13 5 C16 5 18 7 20 10 C22 7 24 5 27 5 C32 5 36 9 36 15 C36 22 28 28 20 35Z"
            fill={accentColor}
            fillOpacity={0.8}
          />
        </svg>
      );

    case 'total_followers': {
      const pct = Math.min(value / 50000, 1);
      const r = (size / 2) - 5;
      const circ = 2 * Math.PI * r;
      return (
        <svg width={size} height={size} className="opacity-80 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accentColor} strokeWidth={3.5} strokeOpacity={0.15} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={accentColor} strokeWidth={3.5}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
      );
    }

    case 'posts_published': {
      const dots = Array.from({ length: 9 });
      const dotSize = featured ? 6 : 5;
      return (
        <div className="grid grid-cols-3 gap-1 opacity-70">
          {dots.map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: dotSize,
                height: dotSize,
                backgroundColor: i < 6 ? accentColor : 'currentColor',
                opacity: i < 6 ? 0.8 : 0.2,
              }}
            />
          ))}
        </div>
      );
    }

    case 'gbp_average_rating': {
      const rating = Math.min(value, 5);
      return (
        <div className="flex gap-0.5 opacity-85">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} width={featured ? 16 : 12} height={featured ? 16 : 12} viewBox="0 0 20 20">
              <polygon
                points="10,1 12.5,7.5 19.5,7.5 13.5,12 15.5,19 10,14.5 4.5,19 6.5,12 0.5,7.5 7.5,7.5"
                fill={i < Math.floor(rating) ? '#F59E0B' : 'none'}
                stroke="#F59E0B"
                strokeWidth={1}
                opacity={i < Math.floor(rating) ? 1 : 0.3}
              />
            </svg>
          ))}
        </div>
      );
    }

    case 'leads':
      return (
        <div className="relative opacity-70" style={{ width: size, height: size }}>
          <div
            className="absolute inset-0 rounded-full border-2 animate-[pulse_2s_ease-in-out_infinite]"
            style={{ borderColor: accentColor }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: size * 0.4,
              height: size * 0.4,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: accentColor,
              opacity: 0.6,
            }}
          />
        </div>
      );

    case 'page_views':
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 50 30" className="opacity-70">
          <polyline
            points="0,25 10,18 20,22 30,10 40,15 50,5"
            fill="none"
            stroke={accentColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'gbp_calls':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="opacity-80 animate-phone-vibrate">
          <path
            d="M11 5 C11 5 15 5 16 9 L17 14 C17 15 16 16 15 16 L13 17 C13 17 15 23 23 27 L24 25 C24 24 25 23 26 23 L31 24 C35 25 35 29 35 29 L35 31 C35 35 31 37 27 35 C21 32 13 25 8 17 C5 12 5 7 5 7 L5 6 C5 5 7 5 11 5Z"
            fill={accentColor}
          />
        </svg>
      );

    case 'website_clicks':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" className="opacity-80">
          <path
            d="M10 8 L10 28 L22 20 Z"
            fill={accentColor}
            className="animate-[pulse_1.5s_ease-in-out_infinite]"
          />
          <circle cx={26} cy={24} r={6} fill="none" stroke={accentColor} strokeWidth={2} strokeOpacity={0.4} className="animate-ring-expand" />
        </svg>
      );

    default:
      return null;
  }
};

/* ─── Card Component ─── */

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
  const { ref, style, overlayStyle, handleMouseMove, handleMouseLeave } = useTilt(5);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className="relative group"
    >
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md min-h-[130px]"
      >
        <div style={overlayStyle} />

        <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-xl" style={{ backgroundColor: accentColor }} />

        <div
          className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: `linear-gradient(180deg, ${accentColor}08 0%, transparent 100%)` }}
        />

        <div className="relative z-10 p-4 pl-5">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="shrink-0 rounded-lg flex items-center justify-center h-7 w-7"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: accentColor }} />
            </div>
            <span className="font-medium text-muted-foreground uppercase tracking-wider font-body text-[10px]">
              {kpi.label}
            </span>
            <MetricTooltip metricKey={kpi.metricKey} />
            {kpi.platforms && kpi.platforms.length > 0 && (
              <div className="flex items-center gap-0.5 ml-auto shrink-0">
                <TooltipProvider delayDuration={200}>
                  {kpi.platforms.slice(0, 5).map((p) => (
                    <Tooltip key={p}>
                      <TooltipTrigger asChild>
                        <img
                          src={PLATFORM_LOGOS[p]}
                          alt={PLATFORM_LABELS[p]}
                          className="h-3.5 w-3.5 object-contain"
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

          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-bold font-body tabular-nums leading-none mb-2 text-foreground text-xl sm:text-2xl">
                {formatValue(animatedValue, isCost, currSymbol, kpi.isPercentage, kpi.isDecimal)}
              </p>

              {change !== undefined && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-full text-[10px]',
                    isPositive === true ? 'bg-accent text-accent-foreground' :
                    isPositive === false ? 'bg-destructive text-destructive-foreground' :
                    'bg-muted text-muted-foreground',
                  )}
                >
                  {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}% vs last month
                </div>
              )}
            </div>

            <div className="shrink-0">
              <MetricVisual metricKey={kpi.metricKey} value={kpi.value} accentColor={accentColor} featured={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */

const HeroKPIs = ({ kpis, currSymbol, sparklineMap }: HeroKPIsProps) => {
  if (kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {kpis.slice(0, 12).map((kpi) => (
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
