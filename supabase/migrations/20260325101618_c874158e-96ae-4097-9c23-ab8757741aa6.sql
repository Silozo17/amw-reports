
-- 1. Create organisations table
CREATE TABLE public.organisations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- 2. Create org_members table
CREATE TABLE public.org_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager')),
  invited_email TEXT,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 3. Add org_id to all data tables (nullable first, we'll set values then make NOT NULL)
ALTER TABLE public.clients ADD COLUMN org_id UUID REFERENCES public.organisations(id);
ALTER TABLE public.reports ADD COLUMN org_id UUID REFERENCES public.organisations(id);
ALTER TABLE public.sync_logs ADD COLUMN org_id UUID REFERENCES public.organisations(id);
ALTER TABLE public.report_logs ADD COLUMN org_id UUID REFERENCES public.organisations(id);
ALTER TABLE public.email_logs ADD COLUMN org_id UUID REFERENCES public.organisations(id);
ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organisations(id);

-- 4. Create helper function to get user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = _user_id LIMIT 1
$$;

-- 5. Migrate existing data: create AMW Media org and assign existing users
DO $$
DECLARE
  amw_org_id UUID;
  owner_user_id UUID;
BEGIN
  -- Find owner user (info@amwmedia.co.uk)
  SELECT au.id INTO owner_user_id FROM auth.users au WHERE au.email = 'info@amwmedia.co.uk';
  
  -- Create AMW Media organisation
  INSERT INTO public.organisations (name, slug, created_by)
  VALUES ('AMW Media', 'amw-media', owner_user_id)
  RETURNING id INTO amw_org_id;

  -- Migrate existing user_roles to org_members
  INSERT INTO public.org_members (org_id, user_id, role, accepted_at)
  SELECT amw_org_id, ur.user_id, ur.role::text, now()
  FROM public.user_roles ur
  ON CONFLICT DO NOTHING;

  -- Set org_id on all existing data
  UPDATE public.clients SET org_id = amw_org_id WHERE org_id IS NULL;
  UPDATE public.reports SET org_id = amw_org_id WHERE org_id IS NULL;
  UPDATE public.sync_logs SET org_id = amw_org_id WHERE org_id IS NULL;
  UPDATE public.report_logs SET org_id = amw_org_id WHERE org_id IS NULL;
  UPDATE public.email_logs SET org_id = amw_org_id WHERE org_id IS NULL;
  UPDATE public.profiles SET org_id = amw_org_id WHERE org_id IS NULL;
END $$;

-- 6. Make org_id NOT NULL on main tables
ALTER TABLE public.clients ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.reports ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.sync_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.report_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN org_id SET NOT NULL;

-- 7. Drop ALL existing RLS policies and recreate with org scoping

-- organisations policies
CREATE POLICY "Members can view own org" ON public.organisations
  FOR SELECT TO authenticated
  USING (id = public.user_org_id(auth.uid()));

CREATE POLICY "Owners can update own org" ON public.organisations
  FOR UPDATE TO authenticated
  USING (id = public.user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.org_members WHERE org_id = id AND user_id = auth.uid() AND role = 'owner'
  ));

-- org_members policies
CREATE POLICY "Members can view own org members" ON public.org_members
  FOR SELECT TO authenticated
  USING (org_id = public.user_org_id(auth.uid()));

CREATE POLICY "Owners can manage org members" ON public.org_members
  FOR ALL TO authenticated
  USING (org_id = public.user_org_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.org_members om WHERE om.org_id = org_members.org_id AND om.user_id = auth.uid() AND om.role = 'owner'
  ));

CREATE POLICY "Users can insert own membership" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- clients: drop old, create new
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can delete clients" ON public.clients;

CREATE POLICY "Org members can view clients" ON public.clients
  FOR SELECT TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org owners can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (org_id = public.user_org_id(auth.uid()));

-- reports
DROP POLICY IF EXISTS "Authenticated can manage reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated can view reports" ON public.reports;

CREATE POLICY "Org members can view reports" ON public.reports
  FOR SELECT TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can manage reports" ON public.reports
  FOR ALL TO authenticated USING (org_id = public.user_org_id(auth.uid()));

-- sync_logs
DROP POLICY IF EXISTS "Authenticated can view sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Authenticated can insert sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Authenticated can delete sync logs" ON public.sync_logs;

CREATE POLICY "Org members can view sync logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can insert sync logs" ON public.sync_logs
  FOR INSERT TO authenticated WITH CHECK (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can delete sync logs" ON public.sync_logs
  FOR DELETE TO authenticated USING (org_id = public.user_org_id(auth.uid()));

-- report_logs
DROP POLICY IF EXISTS "Authenticated can view report logs" ON public.report_logs;
DROP POLICY IF EXISTS "Authenticated can insert report logs" ON public.report_logs;
DROP POLICY IF EXISTS "Authenticated can delete report logs" ON public.report_logs;

CREATE POLICY "Org members can view report logs" ON public.report_logs
  FOR SELECT TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can insert report logs" ON public.report_logs
  FOR INSERT TO authenticated WITH CHECK (org_id = public.user_org_id(auth.uid()));

-- email_logs
DROP POLICY IF EXISTS "Authenticated can manage email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Authenticated can view email logs" ON public.email_logs;

CREATE POLICY "Org members can view email logs" ON public.email_logs
  FOR SELECT TO authenticated USING (org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Org members can manage email logs" ON public.email_logs
  FOR ALL TO authenticated USING (org_id = public.user_org_id(auth.uid()));

-- platform_connections: scope via client's org
DROP POLICY IF EXISTS "Authenticated can manage connections" ON public.platform_connections;
DROP POLICY IF EXISTS "Authenticated can view connections" ON public.platform_connections;

CREATE POLICY "Org members can view connections" ON public.platform_connections
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));
CREATE POLICY "Org members can manage connections" ON public.platform_connections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));

-- client_recipients
DROP POLICY IF EXISTS "Authenticated can manage recipients" ON public.client_recipients;
DROP POLICY IF EXISTS "Authenticated can view recipients" ON public.client_recipients;

CREATE POLICY "Org members can view recipients" ON public.client_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));
CREATE POLICY "Org members can manage recipients" ON public.client_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));

-- client_platform_config
DROP POLICY IF EXISTS "Authenticated can manage config" ON public.client_platform_config;
DROP POLICY IF EXISTS "Authenticated can view config" ON public.client_platform_config;

CREATE POLICY "Org members can view config" ON public.client_platform_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));
CREATE POLICY "Org members can manage config" ON public.client_platform_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));

-- monthly_snapshots
DROP POLICY IF EXISTS "Authenticated can manage snapshots" ON public.monthly_snapshots;
DROP POLICY IF EXISTS "Authenticated can view snapshots" ON public.monthly_snapshots;

CREATE POLICY "Org members can view snapshots" ON public.monthly_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));
CREATE POLICY "Org members can manage snapshots" ON public.monthly_snapshots
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.user_org_id(auth.uid())));

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR org_id = public.user_org_id(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- metric_defaults (keep global access for platform defaults)
DROP POLICY IF EXISTS "Authenticated can view defaults" ON public.metric_defaults;
DROP POLICY IF EXISTS "Owners can manage defaults" ON public.metric_defaults;

CREATE POLICY "Authenticated can view defaults" ON public.metric_defaults
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Org owners can manage defaults" ON public.metric_defaults
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid() AND role = 'owner'));

-- user_roles: keep for backward compat but add org scoping
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can manage roles" ON public.user_roles;

CREATE POLICY "Authenticated can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- 8. Update handle_new_user trigger to NOT auto-assign owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Check if user was invited to an org
  UPDATE public.org_members
  SET user_id = NEW.id, accepted_at = now()
  WHERE invited_email = NEW.email AND user_id IS NULL;

  -- If user joined an org via invite, set their profile org_id
  UPDATE public.profiles
  SET org_id = (SELECT org_id FROM public.org_members WHERE user_id = NEW.id LIMIT 1)
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

-- 9. Add updated_at trigger to organisations
CREATE TRIGGER update_organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Add service role bypass policies for edge functions
-- Edge functions use service role key which bypasses RLS, so no additional policies needed
