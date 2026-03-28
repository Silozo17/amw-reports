
-- Use DO block to only add FKs that don't already exist
DO $$
BEGIN
  -- reports → clients
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_client_id_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_org_id_fkey') THEN
    ALTER TABLE public.reports ADD CONSTRAINT reports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;
  -- sync_logs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_logs_client_id_fkey') THEN
    ALTER TABLE public.sync_logs ADD CONSTRAINT sync_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_logs_org_id_fkey') THEN
    ALTER TABLE public.sync_logs ADD CONSTRAINT sync_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;
  -- report_logs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_logs_client_id_fkey') THEN
    ALTER TABLE public.report_logs ADD CONSTRAINT report_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_logs_org_id_fkey') THEN
    ALTER TABLE public.report_logs ADD CONSTRAINT report_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_logs_report_id_fkey') THEN
    ALTER TABLE public.report_logs ADD CONSTRAINT report_logs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL;
  END IF;
  -- email_logs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_client_id_fkey') THEN
    ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_org_id_fkey') THEN
    ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_report_id_fkey') THEN
    ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL;
  END IF;
  -- monthly_snapshots
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_snapshots_client_id_fkey') THEN
    ALTER TABLE public.monthly_snapshots ADD CONSTRAINT monthly_snapshots_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  -- platform_connections
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_connections_client_id_fkey') THEN
    ALTER TABLE public.platform_connections ADD CONSTRAINT platform_connections_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
  -- onboarding_responses
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_responses_org_id_fkey') THEN
    ALTER TABLE public.onboarding_responses ADD CONSTRAINT onboarding_responses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;
  END IF;
  -- notification_tracking has no FK targets
  -- known_devices has no FK targets
END $$;
