
-- 1. platform_admins table
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 2. is_platform_admin() function
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  )
$$;

-- 3. RLS on platform_admins: only platform admins can read
CREATE POLICY "Platform admins can view" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 4. subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  included_clients integer NOT NULL DEFAULT 1,
  included_connections integer NOT NULL DEFAULT 5,
  additional_client_price numeric(10,2) NOT NULL DEFAULT 0,
  additional_connection_price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plans
CREATE POLICY "Authenticated can view plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

-- Platform admins can manage plans
CREATE POLICY "Platform admins can manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 5. org_subscriptions table
CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  additional_clients integer NOT NULL DEFAULT 0,
  additional_connections integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  override_max_clients integer,
  override_max_connections integer,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can view their own subscription
CREATE POLICY "Org members can view subscription" ON public.org_subscriptions
  FOR SELECT TO authenticated
  USING (org_id = user_org_id(auth.uid()));

-- Platform admins can manage all subscriptions
CREATE POLICY "Platform admins can manage subscriptions" ON public.org_subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 6. INSERT policy on organisations for signup
CREATE POLICY "Users can create org on signup" ON public.organisations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 7. Trigger for updated_at on org_subscriptions
CREATE TRIGGER update_org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Platform admins SELECT on all orgs (for admin panel)
CREATE POLICY "Platform admins can view all orgs" ON public.organisations
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 9. Platform admins UPDATE on all orgs
CREATE POLICY "Platform admins can update all orgs" ON public.organisations
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 10. Platform admins can view all org_members
CREATE POLICY "Platform admins can view all members" ON public.org_members
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 11. Platform admins can view all profiles
CREATE POLICY "Platform admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 12. Platform admins can view all clients (for stats)
CREATE POLICY "Platform admins can view all clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 13. Platform admins can view all connections (for stats)
CREATE POLICY "Platform admins can view all connections" ON public.platform_connections
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
