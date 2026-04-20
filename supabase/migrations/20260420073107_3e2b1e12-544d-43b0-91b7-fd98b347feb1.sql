-- Content Lab v4 Phase 1: additive schema only

-- 1. Verticals
CREATE TABLE public.content_lab_verticals (
  slug text PRIMARY KEY,
  display_name text NOT NULL,
  min_views_tiktok integer NOT NULL DEFAULT 0,
  min_views_instagram integer NOT NULL DEFAULT 0,
  min_views_facebook integer NOT NULL DEFAULT 0,
  geo_focus text,
  keyword_queries text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_lab_verticals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view verticals"
  ON public.content_lab_verticals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins can manage verticals"
  ON public.content_lab_verticals FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_content_lab_verticals_updated
  BEFORE UPDATE ON public.content_lab_verticals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed pool (curated handles, INPUT to scrape)
CREATE TABLE public.content_lab_seed_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_slug text NOT NULL REFERENCES public.content_lab_verticals(slug) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram','tiktok','facebook')),
  handle text NOT NULL,
  display_name text,
  sub_niche text,
  geo text,
  followers_est integer,
  avg_views_est integer,
  notes text,
  verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical_slug, platform, handle)
);

CREATE INDEX idx_seed_pool_vertical_platform
  ON public.content_lab_seed_pool (vertical_slug, platform)
  WHERE is_active;

ALTER TABLE public.content_lab_seed_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active seeds"
  ON public.content_lab_seed_pool FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Platform admins can manage seeds"
  ON public.content_lab_seed_pool FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_content_lab_seed_pool_updated
  BEFORE UPDATE ON public.content_lab_seed_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Additive columns on content_lab_niches
ALTER TABLE public.content_lab_niches
  ADD COLUMN industry_slug text REFERENCES public.content_lab_verticals(slug) ON DELETE SET NULL,
  ADD COLUMN admired_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN competitor_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN brand_voice_snapshot jsonb,
  ADD COLUMN voice_built_at timestamptz;

-- 4. Additive column on org_subscriptions
ALTER TABLE public.org_subscriptions
  ADD COLUMN content_lab_onboarded_at timestamptz;