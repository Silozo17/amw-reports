import { Progress } from '@/components/ui/progress';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import type { QueueState } from '@/lib/syncQueue';
import { Loader2, Clock } from 'lucide-react';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SyncProgressBarProps {
  queueState: QueueState;
  startTime: number;
}

const SyncProgressBar = ({ queueState, startTime }: SyncProgressBarProps) => {
  const { currentJob, currentProgress, queuedJobs } = queueState;

  if (!currentJob) return null;

  const completed = currentProgress?.completed ?? 0;
  const total = currentProgress?.total ?? 1;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const elapsed = (Date.now() - startTime) / 1000;
  const perItem = completed > 0 ? elapsed / completed : 0;
  const remaining = perItem * (total - completed);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const timeLeft = completed > 0
    ? remaining < 60
      ? `~${secs} sec`
      : mins < 60
        ? `~${mins} min ${secs} sec`
        : `~${Math.floor(mins / 60)} hr ${mins % 60} min`
    : 'Estimating...';

  const platformLabel = currentProgress?.platform
    ? (PLATFORM_LABELS[currentProgress.platform as PlatformType] || currentProgress.platform)
    : '';
  const monthLabel = currentProgress?.currentMonth
    ? `${MONTH_NAMES[currentProgress.currentMonth]} ${currentProgress.currentYear}`
    : '';

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
        {completed} of {total} months synced
      </p>

      {queuedJobs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {queuedJobs.map((job) => (
            <div key={job.platform} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1">
              <Clock className="h-3 w-3" />
              <span>{PLATFORM_LABELS[job.platform] || job.platform}</span>
              <span className="text-muted-foreground/60">— Queued</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyncProgressBar;
