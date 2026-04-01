import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { computeHealthScore, getScoreColor, getScoreLabel } from "@/lib/healthScore";
import type { SubScore } from "@/lib/healthScore";
import { cn } from "@/lib/utils";
import type { PlatformType } from "@/types/database";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

interface HealthScoreProps {
  current: SnapshotLike[];
  previous: SnapshotLike[];
}

const CircularGauge = ({ score, change }: { score: number; change?: number }) => {
  const color = getScoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="10"
        />
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
        <span className="text-3xl font-bold font-body tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="max-w-[80%] text-center text-[9px] leading-tight text-muted-foreground uppercase tracking-wider font-body">
          {getScoreLabel(score)}
        </span>
        {change !== undefined && (
          <span className={cn(
            "text-[10px] font-medium font-body",
            change > 0 ? "text-accent" : change < 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change)} pts
          </span>
        )}
      </div>
    </div>
  );
};

const SubScoreCard = ({ sub }: { sub: SubScore }) => {
  if (!sub.hasData) return null;
  const color = getScoreColor(sub.score);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-body shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {sub.score}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{sub.label}</p>
        {sub.change !== undefined && (
          <p className={cn(
            "text-[10px]",
            sub.change > 0 ? "text-accent" : sub.change < 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {sub.change > 0 ? "↑" : sub.change < 0 ? "↓" : "→"} {Math.abs(sub.change)} pts vs last month
          </p>
        )}
      </div>
    </div>
  );
};

const HealthScore = ({ current, previous }: HealthScoreProps) => {
  const result = useMemo(() => computeHealthScore(current, previous), [current, previous]);
  const activeSubScores = result.subScores.filter(s => s.hasData);

  if (activeSubScores.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3 font-body">
              Marketing Health Score
            </p>
            <CircularGauge score={result.overall} />
          </div>
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
            {result.subScores.map(sub => (
              <SubScoreCard key={sub.label} sub={sub} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HealthScore;
