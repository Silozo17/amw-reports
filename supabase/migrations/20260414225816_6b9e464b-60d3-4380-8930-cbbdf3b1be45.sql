
-- Create enum for sync job status
CREATE TYPE public.sync_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create sync_jobs table
CREATE TABLE public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  client_id uuid NOT NULL,
  org_id uuid NOT NULL,
  platform public.platform_type NOT NULL,
  months integer NOT NULL DEFAULT 12,
  status public.sync_job_status NOT NULL DEFAULT 'pending',
  progress_completed integer NOT NULL DEFAULT 0,
  progress_total integer NOT NULL DEFAULT 0,
  current_month integer,
  current_year integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  priority integer NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Org members can view sync jobs for their org
CREATE POLICY "Org members can view sync jobs"
  ON public.sync_jobs
  FOR SELECT
  TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- Org members can insert sync jobs for their org
CREATE POLICY "Org members can insert sync jobs"
  ON public.sync_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

-- Platform admins can view all sync jobs
CREATE POLICY "Platform admins can view all sync jobs"
  ON public.sync_jobs
  FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Platform admins can manage all sync jobs
CREATE POLICY "Platform admins can manage sync jobs"
  ON public.sync_jobs
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Index for efficient queue polling (pending jobs ordered by priority then age)
CREATE INDEX idx_sync_jobs_queue ON public.sync_jobs (status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'processing');

-- Index for client-specific polling
CREATE INDEX idx_sync_jobs_client ON public.sync_jobs (client_id, status);

-- Enable realtime for progress polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
