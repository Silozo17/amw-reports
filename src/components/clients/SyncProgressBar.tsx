import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { PLATFORM_LABELS } from '@/types/database';
import type { PlatformType } from '@/types/database';
import type { SyncJob } from '@/hooks/useSyncJobs';
import { Loader2, Clock } from 'lucide-react';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STALE_PROGRESS_MS = 2 * 60 * 1000; // 2 minutes without progress → "Recovering"

interface SyncProgressBarProps {
  jobs: SyncJob[];
}

const SyncProgressBar = ({ jobs }: SyncProgressBarProps) => {
  // Tick every 15s so the "Recovering" state appears without needing a job update
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  if (jobs.length === 0) return null;

  const processingJob = jobs.find(j => j.status === 'processing');
  const pendingJobs = jobs.filter(j => j.status === 'pending');

  const currentJob = processingJob ?? pendingJobs[0];
  if (!currentJob) return null;

  const completed = currentJob.progress_completed;
  const total = currentJob.progress_total || 1;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const platformLabel = PLATFORM_LABELS[currentJob.platform as PlatformType] || currentJob.platform;
  const monthLabel = currentJob.current_month
    ? `${MONTH_NAMES[currentJob.current_month]} ${currentJob.current_year}`
    : '';

  const isProcessing = currentJob.status === 'processing';

  // Detect "no progress" — if we're processing but updated_at hasn't moved in >2 min,
  // the orchestrator is mid-recovery (cron will pick it up). Show a softer message
  // instead of a falsely-stuck percentage.
  const updatedAt = (currentJob as SyncJob & { updated_at?: string }).updated_at;
  const lastUpdateMs = updatedAt ? Date.parse(updatedAt) : NaN;
  const isRecovering =
    isProcessing &&
    Number.isFinite(lastUpdateMs) &&
    Date.now() - lastUpdateMs > STALE_PROGRESS_MS;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="uppercase tracking-wider text-xs font-bold text-primary">Sync in progress</span>
      </div>
      <div className="relative">
        <Progress value={isProcessing ? percentage : 0} className="h-7" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          <span className="drop-shadow-sm mix-blend-difference text-white">
            {isRecovering
              ? `Recovering — resuming shortly… (${percentage}% · ${platformLabel})`
              : isProcessing
              ? `${percentage}% — Syncing: ${platformLabel} ${monthLabel && `(${monthLabel})`}`
              : `Waiting to start: ${platformLabel}`}
          </span>
        </div>
      </div>
      {isProcessing && !isRecovering && (
        <p className="text-xs text-muted-foreground text-center">
          {completed} of {total} months synced
        </p>
      )}
      {isRecovering && (
        <p className="text-xs text-muted-foreground text-center">
          {completed} of {total} months synced — the queue will resume automatically within a minute.
        </p>
      )}

      {pendingJobs.length > 0 && processingJob && (
        <div className="flex flex-wrap gap-2 pt-1">
          {pendingJobs.map((job) => (
            <div key={job.id} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1">
              <Clock className="h-3 w-3" />
              <span>{PLATFORM_LABELS[job.platform as PlatformType] || job.platform}</span>
              <span className="text-muted-foreground/60">— Queued</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyncProgressBar;
