import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface DiscoveryProgressProps {
  active: boolean;
  estimatedDurationMs?: number;
}

const STEPS = [
  { key: 'scan', label: 'Scanning your website', share: 0.15 },
  { key: 'read', label: 'Reading recent posts', share: 0.25 },
  { key: 'classify', label: 'Classifying your niche', share: 0.15 },
  { key: 'find', label: 'Finding top competitors & global benchmarks', share: 0.30 },
  { key: 'voice', label: 'Building your brand voice profile', share: 0.15 },
] as const;

const DEFAULT_DURATION_MS = 60_000;

const DiscoveryProgress = ({ active, estimatedDurationMs = DEFAULT_DURATION_MS }: DiscoveryProgressProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setStartedAt(null);
      setElapsed(0);
      return;
    }
    setStartedAt(Date.now());
    const id = window.setInterval(() => {
      setElapsed(Date.now() - (startedAt ?? Date.now()));
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  // Compute which step we're on based on elapsed/estimated.
  const progress = Math.min(elapsed / estimatedDurationMs, 0.95);
  let cumulative = 0;
  let currentIndex = STEPS.length - 1;
  for (let i = 0; i < STEPS.length; i++) {
    cumulative += STEPS[i].share;
    if (progress <= cumulative) {
      currentIndex = i;
      break;
    }
  }

  return (
    <ol className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-4 text-sm">
      {STEPS.map((step, i) => {
        const status = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={
                status === 'done'
                  ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  : status === 'active'
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary'
                    : 'flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground'
              }
            >
              {status === 'done' && <Check className="h-3 w-3" />}
              {status === 'active' && <Loader2 className="h-3 w-3 animate-spin" />}
              {status === 'pending' && <span className="text-[10px]">{i + 1}</span>}
            </span>
            <span
              className={
                status === 'pending'
                  ? 'text-muted-foreground'
                  : status === 'active'
                    ? 'font-medium text-foreground'
                    : 'text-foreground'
              }
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default DiscoveryProgress;
