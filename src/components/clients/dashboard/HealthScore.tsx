import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { computeHealthScore, getScoreColor, getScoreLabel } from "@/lib/healthScore";
import type { SubScore } from "@/lib/healthScore";
import { cn } from "@/lib/utils";
import type { PlatformType } from "@/types/database";
import { Progress } from "@/components/ui/progress";
import useTilt from "@/hooks/useTilt";

interface SnapshotLike {
  platform: PlatformType;
  metrics_data: Record<string, number>;
}

interface HealthScoreProps {
  current: SnapshotLike[];
  previous: SnapshotLike[];
  prePrevious?: SnapshotLike[];
}

const CircularGauge = ({ score, change }: { score: number; change?: number }) => {
  const color = getScoreColor(score);
  const radius = 68;
  const strokeWidth = 12;
  const size = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Glow ring behind gauge */}
      <div
        className="absolute inset-2 rounded-full animate-glow-pulse"
        style={{
          boxShadow: `0 0 30px 8px ${color}30`,
        }}
      />
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
        <span className="text-4xl font-bold font-body tabular-nums" style={{ color }}>
          {score}
        </span>
        {change !== undefined && (
          <span className={cn(
            "text-xs font-medium font-body mt-1",
            change > 0 ? "text-accent" : change < 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change)} pts
          </span>
        )}
      </div>
    </div>
  );
};

const SubScoreRow = ({ sub }: { sub: SubScore }) => {
  if (!sub.hasData) return null;
  const color = getScoreColor(sub.score);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{sub.label}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-body tabular-nums" style={{ color }}>
            {sub.score}
          </span>
          {sub.change !== undefined && (
            <span className={cn(
              "text-[10px] font-medium",
              sub.change > 0 ? "text-accent" : sub.change < 0 ? "text-destructive" : "text-muted-foreground"
            )}>
              {sub.change > 0 ? "↑" : sub.change < 0 ? "↓" : "→"}{Math.abs(sub.change)}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${sub.score}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

const HealthScore = ({ current, previous, prePrevious }: HealthScoreProps) => {
  const result = useMemo(() => computeHealthScore(current, previous, prePrevious), [current, previous, prePrevious]);
  const activeSubScores = result.subScores.filter(s => s.hasData);
  const { ref, style, overlayStyle, handleMouseMove, handleMouseLeave } = useTilt(2);

  if (activeSubScores.length === 0) return null;

  const scoreColor = getScoreColor(result.overall);
  const scoreLabel = getScoreLabel(result.overall);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className="relative group"
    >
      <Card className="overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Holographic reflection overlay */}
        <div style={overlayStyle} />

        {/* Gradient header strip */}
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}80)`,
          }}
        />

        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-body">
                Marketing Health Score
              </p>
              <CircularGauge score={result.overall} change={result.change} />
              {/* Score label pill */}
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${scoreColor}18`,
                  color: scoreColor,
                }}
              >
                {scoreLabel}
              </span>
            </div>

            <div className="flex-1 w-full space-y-4">
              {result.subScores.map(sub => (
                <SubScoreRow key={sub.label} sub={sub} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthScore;
