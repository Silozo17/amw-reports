
-- App role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'manager');

-- Platform enum
CREATE TYPE public.platform_type AS ENUM ('google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok', 'linkedin');

-- Sync/report status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'success', 'failed', 'partial');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles table (separate from profiles per security rules)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  position TEXT,
  company_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  business_address TEXT,
  website TEXT,
  social_handles JSONB DEFAULT '{}'::jsonb,
  services_subscribed TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  preferred_currency TEXT DEFAULT 'AUD',
  preferred_timezone TEXT DEFAULT 'Australia/Sydney',
  reporting_start_date DATE,
  account_manager TEXT,
  report_detail_level TEXT DEFAULT 'standard',
  enable_upsell BOOLEAN DEFAULT false,
  enable_mom_comparison BOOLEAN DEFAULT true,
  enable_yoy_comparison BOOLEAN DEFAULT true,
  enable_explanations BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Client recipients
CREATE TABLE public.client_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recipients" ON public.client_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage recipients" ON public.client_recipients FOR ALL TO authenticated USING (true);

-- Platform connections
CREATE TABLE public.platform_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  account_name TEXT,
  account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_sync_status job_status,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view connections" ON public.platform_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage connections" ON public.platform_connections FOR ALL TO authenticated USING (true);

-- Client platform config (which metrics enabled per client per platform)
CREATE TABLE public.client_platform_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_metrics TEXT[] DEFAULT '{}',
  section_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform)
);

ALTER TABLE public.client_platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view config" ON public.client_platform_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage config" ON public.client_platform_config FOR ALL TO authenticated USING (true);

-- Metric defaults per platform
CREATE TABLE public.metric_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform platform_type NOT NULL UNIQUE,
  default_metrics TEXT[] NOT NULL DEFAULT '{}',
  available_metrics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.metric_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view defaults" ON public.metric_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage defaults" ON public.metric_defaults FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Monthly snapshots
CREATE TABLE public.monthly_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  report_month INTEGER NOT NULL,
  report_year INTEGER NOT NULL,
  metrics_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_content JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  snapshot_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform, report_month, report_year)
);

ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view snapshots" ON public.monthly_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage snapshots" ON public.monthly_snapshots FOR ALL TO authenticated USING (true);

-- Reports
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_month INTEGER NOT NULL,
  report_year INTEGER NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  pdf_storage_path TEXT,
  ai_executive_summary TEXT,
  ai_insights TEXT,
  ai_upsell_recommendations TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, report_month, report_year)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reports" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage reports" ON public.reports FOR ALL TO authenticated USING (true);

-- Sync logs
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  status job_status NOT NULL,
  report_month INTEGER NOT NULL,
  report_year INTEGER NOT NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sync logs" ON public.sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sync logs" ON public.sync_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Report logs
CREATE TABLE public.report_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status job_status NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view report logs" ON public.report_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert report logs" ON public.report_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Email logs
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email logs" ON public.email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage email logs" ON public.email_logs FOR ALL TO authenticated USING (true);

-- Storage bucket for reports (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

CREATE POLICY "Authenticated users can read reports" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');
CREATE POLICY "Authenticated users can upload reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');
CREATE POLICY "Authenticated users can update reports" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'reports');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON public.platform_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_platform_config_updated_at BEFORE UPDATE ON public.client_platform_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_snapshots_updated_at BEFORE UPDATE ON public.monthly_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed metric defaults
INSERT INTO public.metric_defaults (platform, default_metrics, available_metrics) VALUES
('google_ads', ARRAY['spend','impressions','clicks','ctr','conversions','conversion_rate','cpc','cost_per_conversion'], ARRAY['spend','impressions','clicks','link_clicks','ctr','conversions','conversion_rate','cpc','cost_per_conversion','reach','leads','campaign_performance']),
('meta_ads', ARRAY['spend','impressions','reach','clicks','ctr','conversions','leads'], ARRAY['spend','impressions','reach','clicks','link_clicks','ctr','conversions','conversion_rate','cpc','cost_per_conversion','leads','campaign_performance']),
('facebook', ARRAY['total_followers','follower_growth','page_likes','impressions','reach','engagement','engagement_rate'], ARRAY['total_followers','follower_growth','audience_growth_rate','page_likes','profile_visits','impressions','reach','engagement','engagement_rate','likes','comments','shares','link_clicks','posts_published','top_posts']),
('instagram', ARRAY['total_followers','follower_growth','reach','impressions','engagement_rate','saves'], ARRAY['total_followers','follower_growth','audience_growth_rate','profile_visits','impressions','reach','engagement','engagement_rate','likes','comments','shares','saves','video_views','link_clicks','posts_published','top_posts']),
('tiktok', ARRAY['total_followers','follower_growth','video_views','engagement','likes','comments','shares'], ARRAY['total_followers','follower_growth','audience_growth_rate','video_views','engagement','engagement_rate','likes','comments','shares','posts_published','top_posts']),
('linkedin', ARRAY['total_followers','follower_growth','impressions','engagement','clicks'], ARRAY['total_followers','follower_growth','audience_growth_rate','impressions','reach','engagement','engagement_rate','likes','comments','shares','clicks','posts_published','top_posts']);
