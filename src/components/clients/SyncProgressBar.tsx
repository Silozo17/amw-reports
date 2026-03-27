import { Progress } from '@/components/ui/progress';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import type { SyncProgress } from '@/lib/triggerSync';
import { Loader2 } from 'lucide-react';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SyncProgressBarProps {
  activeSyncs: Map<string, SyncProgress>;
  startTime: number;
}

const SyncProgressBar = ({ activeSyncs, startTime }: SyncProgressBarProps) => {
  if (activeSyncs.size === 0) return null;

  // Aggregate progress across all platforms
  let totalCompleted = 0;
  let totalItems = 0;
  let currentPlatform = '';
  let currentMonth = 0;
  let currentYear = 0;

  activeSyncs.forEach((progress) => {
    totalCompleted += progress.completed;
    totalItems += progress.total;
    // Show the platform currently being synced (not yet fully complete)
    if (progress.completed < progress.total) {
      currentPlatform = progress.platform;
      currentMonth = progress.currentMonth;
      currentYear = progress.currentYear;
    }
  });

  const percentage = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  // Estimate time remaining
  const elapsed = (Date.now() - startTime) / 1000;
  const perItem = totalCompleted > 0 ? elapsed / totalCompleted : 0;
  const remaining = perItem * (totalItems - totalCompleted);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const timeLeft = totalCompleted > 0
    ? remaining < 60
      ? `~${secs} sec`
      : mins < 60
        ? `~${mins} min ${secs} sec`
        : `~${Math.floor(mins / 60)} hr ${mins % 60} min`
    : 'Estimating...';

  const platformLabel = currentPlatform ? (PLATFORM_LABELS[currentPlatform as PlatformType] || currentPlatform) : '';
  const monthLabel = currentMonth ? `${MONTH_NAMES[currentMonth]} ${currentYear}` : '';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="uppercase tracking-wider text-xs font-bold text-primary">Sync in progress</span>
      </div>
      <div className="relative">
        <Progress value={percentage} className="h-7" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          <span className="drop-shadow-sm mix-blend-difference text-white">
            {percentage}% — Syncing: {platformLabel} {monthLabel && `(${monthLabel})`} · ~{timeLeft}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {totalCompleted} of {totalItems} months synced across {activeSyncs.size} platform{activeSyncs.size > 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default SyncProgressBar;
