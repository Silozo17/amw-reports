import { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardWidget, WidgetData, WidgetType, PlatformRow } from '@/types/widget';
import { PLATFORM_LOGOS, PLATFORM_LABELS } from '@/types/database';
import ChartTypeSelector from './ChartTypeSelector';
import { ExternalLink, ImageOff, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

import { useChartColors } from '@/hooks/useChartColors';

// ─── Animated Counter ──────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 700): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>();

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) { setCurrent(target); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(start + diff * eased);
      if (progress < 1) rafId.current = requestAnimationFrame(tick);
      else prevTarget.current = target;
    };
    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [target, duration]);

  return current;
}

const formatKpiValue = (val: number, isCurrency: boolean, currSymbol: string): string => {
  if (isCurrency)
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
};

const formatCompactValue = (val: number, isCurrency: boolean, currSymbol: string): string => {
  if (isCurrency)
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 10_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
};

// ─── Change Badge ─────────────────────────────────────────────
const ChangeBadge = ({ change, isCost }: { change: number; isCost?: boolean }) => {
  const isPositive = isCost ? change < 0 : change > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-medium whitespace-nowrap',
        isPositive ? 'text-accent' : 'text-destructive',
      )}
    >
      {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
    </span>
  );
};

// ─── Empty State ───────────────────────────────────────────────
const EmptyState = () => (
  <div className="flex items-center justify-center h-full min-h-[60px]">
    <p className="text-xs text-muted-foreground italic">No data to display</p>
  </div>
);

// ─── Compact Metric Widget (per-platform breakdown rows) ──────
const CompactMetricWidget = ({ data }: { data: WidgetData }) => {
  const rows = data.platformRows ?? [];
  const isCost = data.isCost ?? false;
  const currSymbol = data.currSymbol ?? '';

  if (!rows.length) return <EmptyState />;

  const total = rows.reduce((s, r) => s + r.value, 0);
  const prevTotal = rows.reduce((s, r) => {
    if (r.change === undefined || r.change === 0) return s + r.value;
    const prevVal = r.value / (1 + r.change / 100);
    return s + prevVal;
  }, 0);
  const totalChange = prevTotal !== 0 ? ((total - prevTotal) / prevTotal) * 100 : undefined;

  return (
    <div className="flex flex-col h-full justify-between gap-1">
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.platform} className="flex items-center justify-between py-1 px-1 rounded hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              {PLATFORM_LOGOS[row.platform] ? (
                <img src={PLATFORM_LOGOS[row.platform]} alt="" className="h-4 w-4 object-contain flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded bg-muted flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground truncate">{PLATFORM_LABELS[row.platform] ?? row.platform}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold tabular-nums">
                {formatCompactValue(row.value, isCost, currSymbol)}
              </span>
              {row.change !== undefined && <ChangeBadge change={row.change} isCost={isCost} />}
            </div>
          </div>
        ))}
      </div>
      <div>
        <Separator className="my-1" />
        <div className="flex items-center justify-between px-1 py-0.5">
          <span className="text-xs font-semibold text-muted-foreground">Total</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums">
              {formatCompactValue(total, isCost, currSymbol)}
            </span>
            {totalChange !== undefined && <ChangeBadge change={totalChange} isCost={isCost} />}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Number Widget ─────────────────────────────────────────────
const NumberWidget = ({ data }: { data: WidgetData }) => {
  const hasData = data.value !== undefined && data.value !== 0;
  const animatedValue = useAnimatedCounter(data.value ?? 0);
  const isCost = data.isCost ?? false;
  const change = data.change;
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const currSymbol = data.currSymbol ?? '';

  if (!hasData && (!data.sparklineData || data.sparklineData.length < 2)) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-1.5">
        <p className="text-2xl font-display font-bold leading-none">
          {formatKpiValue(animatedValue, isCost, currSymbol)}
        </p>
        {change !== undefined && (
          <div
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
              isPositive === true
                ? 'bg-accent/10 text-accent'
                : isPositive === false
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <span>
              {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {data.sparklineData && data.sparklineData.length > 1 && (
        <div className="-mx-1 mt-auto">
          <ResponsiveContainer width="100%" height={44}>
            <AreaChart data={data.sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${data.value}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill={`url(#spark-${data.value})`}
                dot={false}
                activeDot={{ r: 3, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const { v, name } = payload[0].payload as { v: number; name: string };
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
                      <p className="font-medium">{name}</p>
                      <p className="text-muted-foreground">
                        {isCost
                          ? `${currSymbol}${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : v.toLocaleString()}
                      </p>
                    </div>
                  );
                }}
                cursor={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ─── Progress Ring (Apple Watch style) ─────────────────────────
const ProgressRingWidget = ({ data }: { data: WidgetData }) => {
  const value = data.value ?? 0;
  const hasData = value !== 0;
  const change = data.change;
  const isCost = data.isCost ?? false;
  const currSymbol = data.currSymbol ?? '';
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;

  if (!hasData) return <EmptyState />;

  const pct = Math.min(Math.max(value, 0), 100);
  const radius = 52;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const ringColor = pct >= 70 ? 'hsl(var(--accent))' : pct >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';

  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative">
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-display font-bold leading-none">
            {isCost ? `${currSymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : `${pct.toFixed(0)}%`}
          </span>
          {change !== undefined && (
            <span className={cn('text-[10px] font-medium mt-0.5', isPositive ? 'text-accent' : 'text-destructive')}>
              {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Gauge (semi-circle) ───────────────────────────────────────
const GaugeWidget = ({ data }: { data: WidgetData }) => {
  const value = data.value ?? 0;
  const hasData = value !== 0;
  const change = data.change;
  const isCost = data.isCost ?? false;
  const currSymbol = data.currSymbol ?? '';
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;

  if (!hasData) return <EmptyState />;

  const pct = Math.min(Math.max(value, 0), 100);
  const radius = 60;
  const stroke = 12;
  const halfCirc = Math.PI * radius;
  const offset = halfCirc - (pct / 100) * halfCirc;

  const gaugeColor = pct >= 70 ? 'hsl(var(--accent))' : pct >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg width={160} height={90} viewBox="0 0 160 90" className="overflow-visible">
        <path
          d={`M ${80 - radius} 80 A ${radius} ${radius} 0 0 1 ${80 + radius} 80`}
          fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} strokeLinecap="round"
        />
        <path
          d={`M ${80 - radius} 80 A ${radius} ${radius} 0 0 1 ${80 + radius} 80`}
          fill="none" stroke={gaugeColor} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={halfCirc} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center -mt-10">
        <span className="text-lg font-display font-bold leading-none">
          {isCost ? `${currSymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : `${pct.toFixed(0)}%`}
        </span>
        {change !== undefined && (
          <span className={cn('text-[10px] font-medium mt-0.5', isPositive ? 'text-accent' : 'text-destructive')}>
            {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Sparkline-as-chart (for KPI widgets shown as line/area/bar) ─
const SparklineChart = ({ data, type }: { data: WidgetData; type: 'line' | 'area' | 'bar' }) => {
  const CHART_COLORS = useChartColors();
  const chartData = data.sparklineData ?? [];
  if (chartData.length < 2) return <p className="text-xs text-muted-foreground italic">Insufficient data</p>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'bar' ? (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <RechartsTooltip />
          <Bar dataKey="v" name="Value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : type === 'line' ? (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <RechartsTooltip />
          <Line type="monotone" dataKey="v" name="Value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      ) : (
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <RechartsTooltip />
          <Area type="monotone" dataKey="v" name="Value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#areaGrad)" />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
};

// ─── Generic Chart Widget ──────────────────────────────────────
const ChartWidget = ({ data, type }: { data: WidgetData; type: WidgetType }) => {
  const chartData = (data.chartData ?? []) as Record<string, any>[];
  const config = data.chartConfig;
  if (!chartData.length || !config) return <p className="text-xs text-muted-foreground italic">No data available</p>;

  const { dataKeys, colors, xAxisKey = 'name', stacked, innerRadius = 0 } = config;

  if (type === 'pie' || type === 'donut') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey={dataKeys[0]}
            nameKey={xAxisKey}
            cx="50%"
            cy="50%"
            outerRadius="75%"
            innerRadius={type === 'donut' ? '50%' : 0}
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <RechartsTooltip />
          <Legend />
          {type === 'donut' && data.totalValue && (
            <>
              <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-sm font-bold font-display">
                {data.totalValue}
              </text>
              <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">
                {data.totalLabel ?? 'Total'}
              </text>
            </>
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'radar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey={xAxisKey} tick={{ fontSize: 10 }} />
          <PolarRadiusAxis tick={{ fontSize: 9 }} />
          {dataKeys.map((key, i) => (
            <Radar key={key} name={config.names?.[i] ?? key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} />
          ))}
          <RechartsTooltip />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip />
          {dataKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} name={config.names?.[i] ?? key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          {dataKeys.map((key, i) => (
            <defs key={`def-${key}`}>
              <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0} />
              </linearGradient>
            </defs>
          ))}
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip />
          {dataKeys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} name={config.names?.[i] ?? key} stroke={colors[i % colors.length]} strokeWidth={2} fill={`url(#grad-${key})`} dot={{ r: 3, fill: colors[i % colors.length] }} />
          ))}
          <Legend />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <RechartsTooltip />
        {dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            name={config.names?.[i] ?? key}
            stackId={stacked ? 'stack' : undefined}
            fill={colors[i % colors.length]}
            radius={i === dataKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Table Widget ──────────────────────────────────────────────
const TableWidget = ({ data, widgetId }: { data: WidgetData; widgetId?: string }) => {
  const columns = data.tableColumns ?? [];
  const rows = (data.tableData ?? []) as Record<string, any>[];
  const [platformFilter, setPlatformFilter] = useState('all');

  const isPostsTable = widgetId === 'table-posts';

  const uniquePlatforms = useMemo(() => {
    if (!isPostsTable) return [];
    const platforms = new Set<string>();
    rows.forEach(r => { if (r.platform) platforms.add(r.platform as string); });
    return Array.from(platforms);
  }, [rows, isPostsTable]);

  const filteredRows = useMemo(() => {
    if (!isPostsTable || platformFilter === 'all') return rows;
    return rows.filter(r => r.platform === platformFilter);
  }, [rows, platformFilter, isPostsTable]);

  if (!rows.length) return <p className="text-xs text-muted-foreground italic">No data</p>;

  const renderCell = (col: typeof columns[number], row: Record<string, any>) => {
    const value = row[col.key];

    if (col.type === 'image') {
      return value ? (
        <img
          src={value as string}
          alt=""
          className="h-10 w-10 rounded-md object-cover flex-shrink-0"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </div>
      );
    }

    if (col.type === 'platform') {
      const logo = PLATFORM_LOGOS[value as string];
      return logo ? (
        <img src={logo} alt={PLATFORM_LABELS[value as string] ?? ''} className="h-5 w-5 object-contain" />
      ) : null;
    }

    if (col.type === 'link') {
      return value ? (
        <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null;
    }

    if (col.key === 'content' && typeof value === 'string' && value.length > 120) {
      return <span title={value}>{value.slice(0, 120)}…</span>;
    }

    if (typeof value === 'number') return value.toLocaleString();
    return (value as string) ?? '—';
  };

  return (
    <div className="relative w-full overflow-auto max-h-full space-y-2">
      {isPostsTable && uniquePlatforms.length > 1 && (
        <div className="flex justify-end">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {uniquePlatforms.map(p => (
                <SelectItem key={p} value={p}>
                  <span className="flex items-center gap-2">
                    {PLATFORM_LOGOS[p] && <img src={PLATFORM_LOGOS[p]} alt="" className="h-4 w-4 object-contain" />}
                    {PLATFORM_LABELS[p] ?? p}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={cn(col.align === 'right' ? 'text-right' : '', col.type === 'image' || col.type === 'platform' || col.type === 'link' ? 'w-10 px-2' : '')}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.slice(0, 20).map((row, idx) => (
            <TableRow key={idx}>
              {columns.map((col) => (
                <TableCell key={col.key} className={cn('text-sm', col.align === 'right' && 'text-right tabular-nums', (col.type === 'image' || col.type === 'platform' || col.type === 'link') && 'w-10 px-2')}>
                  {renderCell(col, row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ─── Main WidgetRenderer ───────────────────────────────────────
interface WidgetRendererProps {
  widget: DashboardWidget;
  data: WidgetData;
  onTypeChange: (widgetId: string, newType: WidgetType) => void;
  isEditMode: boolean;
}

const WidgetRenderer = ({ widget, data, onTypeChange, isEditMode }: WidgetRendererProps) => {
  const { type, category } = widget;

  // Check if this is a compact widget with platform rows
  const isCompactWidget = (widget.platformSources?.length ?? 0) > 0 && data.platformRows && data.platformRows.length > 0;

  // KPI widgets shown as chart use sparkline data
  const isKpiAsChart = category === 'kpi' && type !== 'number' && type !== 'progress' && type !== 'gauge';
  const isPlatformAsChart = category === 'platform' && type !== 'number' && type !== 'progress' && type !== 'gauge';

  const platformLogo = widget.platform ? PLATFORM_LOGOS[widget.platform] : undefined;
  const platformLabel = widget.platform ? PLATFORM_LABELS[widget.platform] : undefined;

  return (
    <Card className={cn('h-full overflow-hidden flex flex-col', isEditMode && 'ring-2 ring-primary/20 ring-dashed')}>
      <CardHeader className="pb-1 flex flex-row items-start justify-between space-y-0 px-4 pt-3 gap-1">
        <div className="space-y-0 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {platformLogo && (
              <img src={platformLogo} alt={platformLabel ?? ''} className="h-4 w-4 object-contain flex-shrink-0" />
            )}
            <CardTitle className="text-sm font-display leading-tight tracking-wide line-clamp-2">{widget.label}</CardTitle>
            {widget.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground flex-shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  {widget.description}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {!isCompactWidget && (
          <ChartTypeSelector
            currentType={widget.type}
            compatibleTypes={widget.compatibleTypes}
            onChange={(newType) => onTypeChange(widget.id, newType)}
          />
        )}
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3 pt-1 min-h-0 overflow-auto">
        {isCompactWidget ? (
          <CompactMetricWidget data={data} />
        ) : (
          <>
            {type === 'number' && <NumberWidget data={data} />}
            {type === 'progress' && <ProgressRingWidget data={data} />}
            {type === 'gauge' && <GaugeWidget data={data} />}
            {type === 'table' && <TableWidget data={data} widgetId={widget.id} />}
            {(isKpiAsChart || isPlatformAsChart) && (type === 'line' || type === 'area' || type === 'bar') && (
              <SparklineChart data={data} type={type} />
            )}
            {category === 'chart' && type !== 'table' && (
              <ChartWidget data={data} type={type} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WidgetRenderer;
