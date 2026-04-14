import { cn } from '@/lib/utils';
import { METRIC_LABELS } from '@/types/database';
import { Star, StarHalf } from 'lucide-react';
import MetricTooltip from '@/components/clients/MetricTooltip';
import { COST_METRICS } from './constants';
import { formatMetricValue } from './formatMetricValue';

// ─── Star Rating Display ───────────────────────────────────────
export const StarRating = ({ rating }: { rating: number }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(<Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />);
    } else if (rating >= i - 0.5) {
      stars.push(<StarHalf key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />);
    } else {
      stars.push(<Star key={i} className="h-4 w-4 text-muted-foreground/30" />);
    }
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
};

// ─── Single Metric Card ────────────────────────────────────────
const MetricCard = ({
  metricKey,
  value,
  change,
  currSymbol,
}: {
  metricKey: string;
  value: number;
  change?: number;
  currSymbol: string;
}) => {
  const isCost = COST_METRICS.has(metricKey);
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const label = METRIC_LABELS[metricKey] ?? metricKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const isRating = metricKey === 'gbp_average_rating';

  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body truncate">
          {label}
        </p>
        <MetricTooltip metricKey={metricKey} />
      </div>
      {isRating ? (
        <div className="flex items-center gap-2">
          <StarRating rating={value} />
          <span className="text-xl font-bold font-body tabular-nums leading-none">{value.toFixed(1)}</span>
        </div>
      ) : (
        <p className="text-xl font-bold font-body tabular-nums leading-none">
          {formatMetricValue(metricKey, value, currSymbol)}
        </p>
      )}
      {change !== undefined && (
        <span
          className={cn(
            'inline-flex items-center text-[10px] font-medium',
            isPositive === true ? 'text-accent' :
            isPositive === false ? 'text-destructive' :
            'text-muted-foreground',
          )}
        >
          {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  );
};

export default MetricCard;
