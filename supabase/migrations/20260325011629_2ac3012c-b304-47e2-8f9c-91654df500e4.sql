
-- Add ON DELETE CASCADE to all child table foreign keys referencing clients(id)
-- First drop existing constraints, then re-add with CASCADE

-- client_recipients
ALTER TABLE public.client_recipients DROP CONSTRAINT IF EXISTS client_recipients_client_id_fkey;
ALTER TABLE public.client_recipients ADD CONSTRAINT client_recipients_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- platform_connections
ALTER TABLE public.platform_connections DROP CONSTRAINT IF EXISTS platform_connections_client_id_fkey;
ALTER TABLE public.platform_connections ADD CONSTRAINT platform_connections_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- client_platform_config
ALTER TABLE public.client_platform_config DROP CONSTRAINT IF EXISTS client_platform_config_client_id_fkey;
ALTER TABLE public.client_platform_config ADD CONSTRAINT client_platform_config_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- monthly_snapshots
ALTER TABLE public.monthly_snapshots DROP CONSTRAINT IF EXISTS monthly_snapshots_client_id_fkey;
ALTER TABLE public.monthly_snapshots ADD CONSTRAINT monthly_snapshots_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- sync_logs
ALTER TABLE public.sync_logs DROP CONSTRAINT IF EXISTS sync_logs_client_id_fkey;
ALTER TABLE public.sync_logs ADD CONSTRAINT sync_logs_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- reports
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_client_id_fkey;
ALTER TABLE public.reports ADD CONSTRAINT reports_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- report_logs
ALTER TABLE public.report_logs DROP CONSTRAINT IF EXISTS report_logs_client_id_fkey;
ALTER TABLE public.report_logs ADD CONSTRAINT report_logs_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- email_logs
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_client_id_fkey;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Also add RLS delete policies for sync_logs and report_logs
CREATE POLICY "Authenticated can delete sync logs" ON public.sync_logs FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete report logs" ON public.report_logs FOR DELETE TO authenticated USING (true);
