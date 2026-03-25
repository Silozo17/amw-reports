import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { METRIC_EXPLANATIONS } from '@/types/metrics';

interface HeroMetricCardProps {
  label: string;
  metricKey: string;
  value: string;
  change?: number;
  isCost?: boolean;
  accentColor?: string;
}

const HeroMetricCard = ({ label, metricKey, value, change, isCost, accentColor }: HeroMetricCardProps) => {
  const isPositive = change !== undefined ? (isCost ? change < 0 : change > 0) : undefined;
  const explanation = METRIC_EXPLANATIONS[metricKey];

  return (
    <Card className="relative overflow-hidden">
      {accentColor && (
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accentColor }} />
      )}
      <CardContent className="p-5 pt-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-display font-bold mb-1">{value}</p>
        {change !== undefined && (
          <div className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            isPositive === true ? 'bg-accent/10 text-accent' :
            isPositive === false ? 'bg-destructive/10 text-destructive' :
            'bg-muted text-muted-foreground'
          )}>
            <span>
              {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}% from last month
            </span>
          </div>
        )}
        {explanation && (
          <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">{explanation}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default HeroMetricCard;
