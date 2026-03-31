import { useMemo } from "react";
import { TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { computeOpportunityAlerts } from "@/lib/opportunityAlerts";
import type { OpportunityAlert, AlertType } from "@/lib/opportunityAlerts";
import { PLATFORM_LOGOS, PLATFORM_LABELS } from "@/types/database";
import type { PlatformType } from "@/types/database";
import { cn } from "@/lib/utils";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

interface OpportunityAlertsProps {
  current: SnapshotLike[];
  previous: SnapshotLike[];
  currSymbol: string;
}

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
  win: { bg: "bg-accent/5", border: "border-accent/20", icon: TrendingUp, iconColor: "text-accent" },
  opportunity: { bg: "bg-primary/5", border: "border-primary/20", icon: Lightbulb, iconColor: "text-primary" },
  warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: TrendingDown, iconColor: "text-amber-500" },
};

const AlertCard = ({ alert }: { alert: OpportunityAlert }) => {
  const style = ALERT_STYLES[alert.type];
  const Icon = style.icon;

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg border min-w-[280px] max-w-[340px] shrink-0",
      style.bg, style.border,
    )}>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <Icon className={cn("h-4 w-4", style.iconColor)} />
        <img
          src={PLATFORM_LOGOS[alert.platform]}
          alt={PLATFORM_LABELS[alert.platform]}
          className="h-4 w-4 object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
      </div>
    </div>
  );
};

const OpportunityAlerts = ({ current, previous, currSymbol }: OpportunityAlertsProps) => {
  const alerts = useMemo(
    () => computeOpportunityAlerts(current, previous, currSymbol),
    [current, previous, currSymbol],
  );

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-body">
        Insights & Opportunities
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {alerts.map(alert => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
};

export default OpportunityAlerts;
