import { useEffect, useState } from 'react';
import { Check, Layers, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface RunStepDef {
  label: string;
  detail: string;
  badge?: string;
}

interface Props {
  steps: RunStepDef[];
  currentStepIndex: number; // -1 not started; steps.length means done
  estimatedSeconds?: number;
  title?: string;
}

const STAGGER_MS = 150;
const DEFAULT_ETA = 120;

const formatEta = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${m}m ${s}s`;
};

const RunProgressStepper = ({
  steps,
  currentStepIndex,
  estimatedSeconds = DEFAULT_ETA,
  title = 'Generating your report',
}: Props) => {
  const total = steps.length;
  const done = Math.max(0, Math.min(currentStepIndex, total));
  const targetPct = Math.min(100, ((done + (done < total ? 0.5 : 0)) / total) * 100);

  // Smooth bar fill — ease toward target after mount
  const [barPct, setBarPct] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setBarPct(targetPct), 50);
    return () => window.clearTimeout(t);
  }, [targetPct]);

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-5 md:p-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">Estimated time: {formatEta(estimatedSeconds)}</p>
        </div>
      </header>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(targetPct)}
      >
        <div
          className="h-full rounded-full bg-primary transition-all ease-out"
          style={{
            width: `${barPct}%`,
            transitionDuration: `${Math.max(estimatedSeconds * 1000, 600)}ms`,
          }}
        />
      </div>

      <ol className="relative space-y-5">
        <span aria-hidden className="absolute bottom-2 left-[19px] top-2 w-px bg-border" />
        {steps.map((step, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < currentStepIndex ? 'done' : i === currentStepIndex ? 'active' : 'pending';
          return (
            <li
              key={step.label}
              className="relative flex animate-fade-in items-start gap-3 opacity-0"
              style={{ animationDelay: `${i * STAGGER_MS}ms`, animationFillMode: 'forwards' }}
            >
              <StepIndicator state={state} index={i} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={
                    state === 'pending'
                      ? 'text-sm text-muted-foreground'
                      : state === 'done'
                      ? 'text-sm font-medium text-muted-foreground'
                      : 'text-sm font-semibold text-foreground'
                  }
                >
                  {step.label}
                </p>
                <p
                  className={
                    state === 'active'
                      ? 'mt-0.5 animate-pulse text-xs text-primary'
                      : 'mt-0.5 text-xs text-muted-foreground'
                  }
                >
                  {step.detail}
                </p>
                {state === 'done' && step.badge && (
                  <Badge variant="secondary" className="mt-2 animate-fade-in text-[10px]">
                    {step.badge}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const StepIndicator = ({ state, index }: { state: 'done' | 'active' | 'pending'; index: number }) => {
  if (state === 'done') {
    return (
      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Check className="h-5 w-5 animate-scale-in" />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/15 text-primary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {index + 1}
    </span>
  );
};

export default RunProgressStepper;
