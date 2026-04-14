import { triggerInitialSync, type SyncProgress } from '@/lib/triggerSync';
import type { PlatformType } from '@/types/database';

export interface SyncJob {
  connectionId: string;
  platform: PlatformType;
  months: number;
}

export interface QueueState {
  currentJob: SyncJob | null;
  queuedJobs: SyncJob[];
  currentProgress: SyncProgress | null;
}

type StateListener = (state: QueueState) => void;

export class SyncQueue {
  private queue: SyncJob[] = [];
  private currentJob: SyncJob | null = null;
  private currentProgress: SyncProgress | null = null;
  private processing = false;
  private listener: StateListener | null = null;
  private onComplete: (() => void) | null = null;

  constructor(onStateChange: StateListener, onComplete?: () => void) {
    this.listener = onStateChange;
    this.onComplete = onComplete ?? null;
  }

  enqueue(job: SyncJob): void {
    // Don't queue duplicates for the same platform
    const isDuplicate =
      (this.currentJob?.platform === job.platform) ||
      this.queue.some(q => q.platform === job.platform);
    if (isDuplicate) return;

    this.queue.push(job);
    this.emit();

    if (!this.processing) {
      this.processNext();
    }
  }

  getState(): QueueState {
    return {
      currentJob: this.currentJob,
      queuedJobs: [...this.queue],
      currentProgress: this.currentProgress,
    };
  }

  private emit(): void {
    this.listener?.(this.getState());
  }

  private async processNext(): Promise<void> {
    const nextJob = this.queue.shift();
    if (!nextJob) {
      this.processing = false;
      this.currentJob = null;
      this.currentProgress = null;
      this.emit();
      this.onComplete?.();
      return;
    }

    this.processing = true;
    this.currentJob = nextJob;
    this.currentProgress = {
      platform: nextJob.platform,
      completed: 0,
      total: nextJob.months,
      currentMonth: 0,
      currentYear: 0,
    };
    this.emit();

    let lastError: unknown = null;
    try {
      const results = await triggerInitialSync(
        nextJob.connectionId,
        nextJob.platform,
        nextJob.months,
        (progress) => {
          this.currentProgress = progress;
          this.emit();
        },
      );

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        lastError = failures;
      }
    } catch (err) {
      lastError = err;
    }

    await this.processNext();
  }
}
