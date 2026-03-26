
CREATE POLICY "Platform admins can view all sync logs" ON public.sync_logs FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all reports" ON public.reports FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all email logs" ON public.email_logs FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all snapshots" ON public.monthly_snapshots FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can view all report logs" ON public.report_logs FOR SELECT TO authenticated USING (is_platform_admin(auth.uid()));
