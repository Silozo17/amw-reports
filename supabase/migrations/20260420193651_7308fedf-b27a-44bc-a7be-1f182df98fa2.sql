
-- Add email_on_complete column for Content Lab run notifications
ALTER TABLE public.content_lab_runs
  ADD COLUMN IF NOT EXISTS email_on_complete boolean NOT NULL DEFAULT true;

-- Cleanup: mark the stuck B2B run completed (12 ideas already exist for it)
UPDATE public.content_lab_runs
   SET status = 'completed',
       completed_at = COALESCE(completed_at, now()),
       updated_at  = now(),
       error_message = NULL
 WHERE id = '875ea4f0-d893-4005-abd7-a84a01de8205'
   AND status = 'ideating';

-- Cleanup: fail any other run stuck >10min in an active state
UPDATE public.content_lab_runs
   SET status = 'failed',
       error_message = 'Auto-failed: stuck >10min in active state (orchestrator overhaul cleanup).',
       completed_at = COALESCE(completed_at, now()),
       updated_at = now()
 WHERE status IN ('pending','scraping','analysing','ideating')
   AND updated_at < now() - interval '10 minutes';

-- Close any orphan started step logs whose runs are no longer active
UPDATE public.content_lab_step_logs
   SET status = 'failed',
       completed_at = COALESCE(completed_at, now()),
       error_message = COALESCE(error_message, 'Auto-closed by orchestrator overhaul cleanup')
 WHERE status = 'started'
   AND run_id IN (
     SELECT id FROM public.content_lab_runs
      WHERE status IN ('completed','failed')
   );
