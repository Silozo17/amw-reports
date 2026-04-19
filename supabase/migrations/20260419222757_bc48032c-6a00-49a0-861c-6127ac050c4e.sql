-- Step status enum
DO $$ BEGIN
  CREATE TYPE public.content_lab_step_status AS ENUM ('started', 'ok', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.content_lab_step_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  step text NOT NULL,
  status public.content_lab_step_status NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_lab_step_logs_run_id ON public.content_lab_step_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_content_lab_step_logs_created_at ON public.content_lab_step_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_lab_step_logs_status ON public.content_lab_step_logs(status);

ALTER TABLE public.content_lab_step_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all step logs"
  ON public.content_lab_step_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Org members can view own step logs"
  ON public.content_lab_step_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_step_logs.run_id
      AND public.user_belongs_to_org(auth.uid(), r.org_id)
  ));
