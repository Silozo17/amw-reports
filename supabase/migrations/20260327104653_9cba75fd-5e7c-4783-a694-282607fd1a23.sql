
-- Create client_users table
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invited_by uuid,
  invited_email text,
  invited_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is a client_user for a given client
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE user_id = _user_id AND client_id = _client_id
  )
$$;

-- Security definer to check if user is ANY client_user
CREATE OR REPLACE FUNCTION public.get_client_user_info(_user_id uuid)
RETURNS TABLE(client_id uuid, org_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.client_id, cu.org_id FROM public.client_users cu
  WHERE cu.user_id = _user_id LIMIT 1
$$;

-- RLS on client_users
CREATE POLICY "Client users can view own row" ON public.client_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org members can view client users" ON public.client_users
  FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Org members can insert client users" ON public.client_users
  FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Org members can delete client users" ON public.client_users
  FOR DELETE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can manage client users" ON public.client_users
  FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Allow client_users to SELECT their own client record
CREATE POLICY "Client users can view own client" ON public.clients
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), id));

-- Allow client_users to view connections for their client
CREATE POLICY "Client users can view own connections" ON public.platform_connections
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

-- Allow client_users to manage (insert/update/delete) connections for their client
CREATE POLICY "Client users can manage own connections" ON public.platform_connections
  FOR ALL TO authenticated
  USING (is_client_user(auth.uid(), client_id))
  WITH CHECK (is_client_user(auth.uid(), client_id));

-- Allow client_users to view snapshots for their client
CREATE POLICY "Client users can view own snapshots" ON public.monthly_snapshots
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

-- Allow client_users to view their client's platform config
CREATE POLICY "Client users can view own platform config" ON public.client_platform_config
  FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

-- Allow client_users to view their org (for branding)
CREATE POLICY "Client users can view own org" ON public.organisations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid() AND cu.org_id = organisations.id
  ));
