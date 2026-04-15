ALTER TABLE public.sync_jobs
ADD COLUMN force_resync boolean NOT NULL DEFAULT false,
ADD COLUMN target_months jsonb DEFAULT NULL;