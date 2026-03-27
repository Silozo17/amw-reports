
-- 1. Create user_belongs_to_org function
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

-- 2. Create is_org_owner_of function (org-scoped owner check)
CREATE OR REPLACE FUNCTION public.is_org_owner_of(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = 'owner'
  )
$$;

-- ============================================================
-- 3. UPDATE RLS POLICIES ON: clients
-- ============================================================
DROP POLICY IF EXISTS "Org members can view clients" ON public.clients;
CREATE POLICY "Org members can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can insert clients" ON public.clients;
CREATE POLICY "Org members can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can update clients" ON public.clients;
CREATE POLICY "Org members can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org owners can delete clients" ON public.clients;
CREATE POLICY "Org owners can delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 4. UPDATE RLS POLICIES ON: client_share_tokens
-- ============================================================
DROP POLICY IF EXISTS "Org members can manage share tokens" ON public.client_share_tokens;
CREATE POLICY "Org members can manage share tokens" ON public.client_share_tokens
  FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 5. UPDATE RLS POLICIES ON: email_logs
-- ============================================================
DROP POLICY IF EXISTS "Org members can manage email logs" ON public.email_logs;
CREATE POLICY "Org members can manage email logs" ON public.email_logs
  FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can view email logs" ON public.email_logs;
CREATE POLICY "Org members can view email logs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 6. UPDATE RLS POLICIES ON: org_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view own org members" ON public.org_members;
CREATE POLICY "Members can view own org members" ON public.org_members
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Owners can manage org members" ON public.org_members;
CREATE POLICY "Owners can manage org members" ON public.org_members
  FOR ALL TO authenticated
  USING (is_org_owner_of(auth.uid(), org_id));

-- ============================================================
-- 7. UPDATE RLS POLICIES ON: org_subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Org members can view subscription" ON public.org_subscriptions;
CREATE POLICY "Org members can view subscription" ON public.org_subscriptions
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can create own org subscription" ON public.org_subscriptions;
CREATE POLICY "Users can create own org subscription" ON public.org_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 8. UPDATE RLS POLICIES ON: organisations
-- ============================================================
DROP POLICY IF EXISTS "Members can view own org" ON public.organisations;
CREATE POLICY "Members can view own org" ON public.organisations
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), id));

DROP POLICY IF EXISTS "Owners can update own org" ON public.organisations;
CREATE POLICY "Owners can update own org" ON public.organisations
  FOR UPDATE TO authenticated
  USING (is_org_owner_of(auth.uid(), id));

-- ============================================================
-- 9. UPDATE RLS POLICIES ON: report_logs
-- ============================================================
DROP POLICY IF EXISTS "Org members can insert report logs" ON public.report_logs;
CREATE POLICY "Org members can insert report logs" ON public.report_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can view report logs" ON public.report_logs;
CREATE POLICY "Org members can view report logs" ON public.report_logs
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 10. UPDATE RLS POLICIES ON: reports
-- ============================================================
DROP POLICY IF EXISTS "Org members can manage reports" ON public.reports;
CREATE POLICY "Org members can manage reports" ON public.reports
  FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can view reports" ON public.reports;
CREATE POLICY "Org members can view reports" ON public.reports
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 11. UPDATE RLS POLICIES ON: sync_logs
-- ============================================================
DROP POLICY IF EXISTS "Org members can delete sync logs" ON public.sync_logs;
CREATE POLICY "Org members can delete sync logs" ON public.sync_logs
  FOR DELETE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can insert sync logs" ON public.sync_logs;
CREATE POLICY "Org members can insert sync logs" ON public.sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can view sync logs" ON public.sync_logs;
CREATE POLICY "Org members can view sync logs" ON public.sync_logs
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

-- ============================================================
-- 12. UPDATE RLS POLICIES ON: custom_domains
-- ============================================================
DROP POLICY IF EXISTS "Org members can view domains" ON public.custom_domains;
CREATE POLICY "Org members can view domains" ON public.custom_domains
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org owners can manage domains" ON public.custom_domains;
CREATE POLICY "Org owners can manage domains" ON public.custom_domains
  FOR ALL TO authenticated
  USING (is_org_owner_of(auth.uid(), org_id));

-- ============================================================
-- 13. UPDATE RLS ON joined tables (client_platform_config, client_recipients, monthly_snapshots, platform_connections)
-- These join through clients table — update to use user_belongs_to_org
-- ============================================================

DROP POLICY IF EXISTS "Org members can manage config" ON public.client_platform_config;
CREATE POLICY "Org members can manage config" ON public.client_platform_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_platform_config.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can view config" ON public.client_platform_config;
CREATE POLICY "Org members can view config" ON public.client_platform_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_platform_config.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can manage recipients" ON public.client_recipients;
CREATE POLICY "Org members can manage recipients" ON public.client_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_recipients.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can view recipients" ON public.client_recipients;
CREATE POLICY "Org members can view recipients" ON public.client_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_recipients.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can manage snapshots" ON public.monthly_snapshots;
CREATE POLICY "Org members can manage snapshots" ON public.monthly_snapshots
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = monthly_snapshots.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can view snapshots" ON public.monthly_snapshots;
CREATE POLICY "Org members can view snapshots" ON public.monthly_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = monthly_snapshots.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can manage connections" ON public.platform_connections;
CREATE POLICY "Org members can manage connections" ON public.platform_connections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = platform_connections.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

DROP POLICY IF EXISTS "Org members can view connections" ON public.platform_connections;
CREATE POLICY "Org members can view connections" ON public.platform_connections
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = platform_connections.client_id AND user_belongs_to_org(auth.uid(), c.org_id)));

-- 14. Update profiles RLS to support multi-org view
DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;
CREATE POLICY "Users can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_belongs_to_org(auth.uid(), org_id));
