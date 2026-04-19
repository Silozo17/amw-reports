-- =========================================================================
-- Content Lab — Phase 1 Schema
-- =========================================================================

-- Enums
CREATE TYPE public.content_lab_run_status AS ENUM (
  'pending', 'scraping', 'analysing', 'ideating', 'rendering', 'completed', 'failed'
);

CREATE TYPE public.content_lab_post_source AS ENUM ('oauth', 'apify');

CREATE TYPE public.content_lab_platform AS ENUM ('instagram', 'tiktok', 'facebook');

-- Add tier column to existing subscriptions
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS content_lab_tier text
  CHECK (content_lab_tier IS NULL OR content_lab_tier IN ('lite', 'pro', 'agency'));

-- =========================================================================
-- TABLE: content_lab_niches
-- =========================================================================
CREATE TABLE public.content_lab_niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  label text NOT NULL,
  tracked_handles jsonb NOT NULL DEFAULT '[]'::jsonb,
  tracked_hashtags text[] NOT NULL DEFAULT '{}',
  tracked_keywords text[] NOT NULL DEFAULT '{}',
  competitor_urls text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_niches_client ON public.content_lab_niches(client_id);
CREATE INDEX idx_content_lab_niches_org ON public.content_lab_niches(org_id);

ALTER TABLE public.content_lab_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage niches"
  ON public.content_lab_niches FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Client users can view own niches"
  ON public.content_lab_niches FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

CREATE POLICY "Platform admins can view all niches"
  ON public.content_lab_niches FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_content_lab_niches_updated_at
  BEFORE UPDATE ON public.content_lab_niches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: content_lab_runs
-- =========================================================================
CREATE TABLE public.content_lab_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  niche_id uuid NOT NULL REFERENCES public.content_lab_niches(id) ON DELETE CASCADE,
  status public.content_lab_run_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  pdf_storage_path text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_pence integer NOT NULL DEFAULT 0,
  error_message text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_runs_client ON public.content_lab_runs(client_id);
CREATE INDEX idx_content_lab_runs_org ON public.content_lab_runs(org_id);
CREATE INDEX idx_content_lab_runs_niche ON public.content_lab_runs(niche_id);
CREATE INDEX idx_content_lab_runs_status ON public.content_lab_runs(status);

ALTER TABLE public.content_lab_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage runs"
  ON public.content_lab_runs FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Client users can view own runs"
  ON public.content_lab_runs FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));

CREATE POLICY "Platform admins can view all runs"
  ON public.content_lab_runs FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE TRIGGER trg_content_lab_runs_updated_at
  BEFORE UPDATE ON public.content_lab_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- TABLE: content_lab_posts
-- =========================================================================
CREATE TABLE public.content_lab_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  platform public.content_lab_platform NOT NULL,
  source public.content_lab_post_source NOT NULL,
  author_handle text NOT NULL,
  post_url text,
  post_type text,
  caption text,
  thumbnail_url text,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  engagement_rate numeric(6,4) NOT NULL DEFAULT 0,
  posted_at timestamptz,
  bucket text,
  ai_summary text,
  hook_text text,
  hook_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_posts_run ON public.content_lab_posts(run_id);
CREATE INDEX idx_content_lab_posts_platform ON public.content_lab_posts(platform);
CREATE INDEX idx_content_lab_posts_engagement ON public.content_lab_posts(engagement_rate DESC);

ALTER TABLE public.content_lab_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage posts"
  ON public.content_lab_posts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_posts.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_posts.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ));

CREATE POLICY "Client users can view own posts"
  ON public.content_lab_posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_posts.run_id
      AND is_client_user(auth.uid(), r.client_id)
  ));

CREATE POLICY "Platform admins can view all posts"
  ON public.content_lab_posts FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =========================================================================
-- TABLE: content_lab_trends
-- =========================================================================
CREATE TABLE public.content_lab_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  momentum text,
  verification_source text,
  verification_url text,
  recommendation text,
  supporting_post_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_trends_run ON public.content_lab_trends(run_id);

ALTER TABLE public.content_lab_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage trends"
  ON public.content_lab_trends FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_trends.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_trends.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ));

CREATE POLICY "Client users can view own trends"
  ON public.content_lab_trends FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_trends.run_id
      AND is_client_user(auth.uid(), r.client_id)
  ));

CREATE POLICY "Platform admins can view all trends"
  ON public.content_lab_trends FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =========================================================================
-- TABLE: content_lab_ideas
-- =========================================================================
CREATE TABLE public.content_lab_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  idea_number integer NOT NULL,
  title text NOT NULL,
  based_on_post_id uuid REFERENCES public.content_lab_posts(id) ON DELETE SET NULL,
  caption text,
  hook text,
  body text,
  cta text,
  duration_seconds integer,
  visual_direction text,
  why_it_works text,
  hashtags text[] NOT NULL DEFAULT '{}',
  filming_checklist text[] NOT NULL DEFAULT '{}',
  rating integer CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_ideas_run ON public.content_lab_ideas(run_id);
CREATE UNIQUE INDEX idx_content_lab_ideas_run_number ON public.content_lab_ideas(run_id, idea_number);

ALTER TABLE public.content_lab_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage ideas"
  ON public.content_lab_ideas FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_ideas.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_ideas.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ));

CREATE POLICY "Client users can view own ideas"
  ON public.content_lab_ideas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_ideas.run_id
      AND is_client_user(auth.uid(), r.client_id)
  ));

CREATE POLICY "Platform admins can view all ideas"
  ON public.content_lab_ideas FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =========================================================================
-- TABLE: content_lab_hooks
-- =========================================================================
CREATE TABLE public.content_lab_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  hook_text text NOT NULL,
  source_post_id uuid REFERENCES public.content_lab_posts(id) ON DELETE SET NULL,
  mechanism text,
  why_it_works text,
  engagement_score numeric(6,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_hooks_run ON public.content_lab_hooks(run_id);

ALTER TABLE public.content_lab_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage hooks"
  ON public.content_lab_hooks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_hooks.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_hooks.run_id
      AND user_belongs_to_org(auth.uid(), r.org_id)
  ));

CREATE POLICY "Client users can view own hooks"
  ON public.content_lab_hooks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_runs r
    WHERE r.id = content_lab_hooks.run_id
      AND is_client_user(auth.uid(), r.client_id)
  ));

CREATE POLICY "Platform admins can view all hooks"
  ON public.content_lab_hooks FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-lab-thumbs', 'content-lab-thumbs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-lab-reports', 'content-lab-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for thumbnails
CREATE POLICY "Content lab thumbs are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-lab-thumbs');

CREATE POLICY "Org members can upload thumbs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-lab-thumbs');

CREATE POLICY "Org members can update thumbs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'content-lab-thumbs');

CREATE POLICY "Org members can delete thumbs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'content-lab-thumbs');

-- Reports bucket: org-scoped via folder = org_id
CREATE POLICY "Org members can read own content lab reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'content-lab-reports'
    AND (
      user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "Org members can upload content lab reports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'content-lab-reports'
    AND user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members can update content lab reports"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'content-lab-reports'
    AND user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Org members can delete content lab reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'content-lab-reports'
    AND user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );