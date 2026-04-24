-- DROP LEGACY TABLES (data backed up to storage)
DROP TABLE IF EXISTS public.content_lab_idea_comments CASCADE;
DROP TABLE IF EXISTS public.content_lab_swipe_insights CASCADE;
DROP TABLE IF EXISTS public.content_lab_swipe_file CASCADE;
DROP TABLE IF EXISTS public.content_lab_step_logs CASCADE;
DROP TABLE IF EXISTS public.content_lab_trends CASCADE;
DROP TABLE IF EXISTS public.content_lab_hooks CASCADE;
DROP TABLE IF EXISTS public.content_lab_ideas CASCADE;
DROP TABLE IF EXISTS public.content_lab_posts CASCADE;
DROP TABLE IF EXISTS public.content_lab_run_share_tokens CASCADE;
DROP TABLE IF EXISTS public.content_lab_runs CASCADE;
DROP TABLE IF EXISTS public.content_lab_niches CASCADE;
DROP TABLE IF EXISTS public.content_lab_pool_refresh_jobs CASCADE;
DROP TABLE IF EXISTS public.content_lab_benchmark_pool CASCADE;
DROP TABLE IF EXISTS public.content_lab_seed_pool CASCADE;
DROP TABLE IF EXISTS public.content_lab_verticals CASCADE;

DROP FUNCTION IF EXISTS public.get_global_hook_library(text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_shared_run(text) CASCADE;
DROP FUNCTION IF EXISTS public.slugify_niche_tag(text) CASCADE;
DROP VIEW IF EXISTS public.v_content_lab_mrr_by_tier CASCADE;
DROP VIEW IF EXISTS public.v_content_lab_run_completion CASCADE;
DROP VIEW IF EXISTS public.v_content_lab_pool_quality CASCADE;
DROP VIEW IF EXISTS public.v_content_lab_churn_signals CASCADE;
DROP VIEW IF EXISTS public.v_content_lab_regen_rate CASCADE;
DROP FUNCTION IF EXISTS public.get_content_lab_analytics() CASCADE;

DROP TYPE IF EXISTS public.content_lab_run_status CASCADE;
DROP TYPE IF EXISTS public.content_lab_post_bucket CASCADE;

-- EXTEND CLIENTS
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS industry text;

-- ENUMS (reuse existing platform_type enum elsewhere; create only new ones)
CREATE TYPE public.content_lab_run_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'cancelled'
);
CREATE TYPE public.content_lab_post_bucket AS ENUM ('own', 'competitor', 'viral');

-- We use TEXT (not enum) for platform on new tables to keep flexibility:
-- values constrained to: 'instagram', 'tiktok', 'facebook'

-- RUNS
CREATE TABLE public.content_lab_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  client_id uuid NOT NULL,
  triggered_by uuid,
  status public.content_lab_run_status NOT NULL DEFAULT 'pending',
  current_phase text,
  error_message text,
  cost_pence integer NOT NULL DEFAULT 0,
  client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_lab_runs_org ON public.content_lab_runs(org_id);
CREATE INDEX idx_content_lab_runs_client ON public.content_lab_runs(client_id);
CREATE INDEX idx_content_lab_runs_status ON public.content_lab_runs(status);
ALTER TABLE public.content_lab_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage runs" ON public.content_lab_runs FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Client users view own runs" ON public.content_lab_runs FOR SELECT TO authenticated
  USING (is_client_user(auth.uid(), client_id));
CREATE POLICY "Platform admins view all runs" ON public.content_lab_runs FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
CREATE TRIGGER trg_content_lab_runs_updated BEFORE UPDATE ON public.content_lab_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RUN PROGRESS
CREATE TABLE public.content_lab_run_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  phase text NOT NULL,
  status text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_run_progress_run ON public.content_lab_run_progress(run_id, created_at);
ALTER TABLE public.content_lab_run_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view progress" ON public.content_lab_run_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND user_belongs_to_org(auth.uid(), r.org_id)));
CREATE POLICY "Client users view progress" ON public.content_lab_run_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND is_client_user(auth.uid(), r.client_id)));
CREATE POLICY "Platform admins view progress" ON public.content_lab_run_progress FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- POSTS
CREATE TABLE public.content_lab_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  bucket public.content_lab_post_bucket NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram','tiktok','facebook')),
  author_handle text NOT NULL,
  author_display_name text,
  author_followers integer,
  post_url text,
  external_id text,
  post_type text,
  caption text,
  transcript text,
  thumbnail_url text,
  hook_text text,
  hook_type text,
  pattern_tag text,
  hashtags text[] NOT NULL DEFAULT '{}',
  mentions text[] NOT NULL DEFAULT '{}',
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  engagement_rate numeric NOT NULL DEFAULT 0,
  video_duration_seconds integer,
  posted_at timestamptz,
  source_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_lab_posts_run ON public.content_lab_posts(run_id);
CREATE INDEX idx_content_lab_posts_bucket ON public.content_lab_posts(run_id, bucket);
CREATE INDEX idx_content_lab_posts_views ON public.content_lab_posts(run_id, views DESC);
CREATE UNIQUE INDEX idx_content_lab_posts_dedup ON public.content_lab_posts(run_id, platform, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE public.content_lab_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage posts" ON public.content_lab_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND user_belongs_to_org(auth.uid(), r.org_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND user_belongs_to_org(auth.uid(), r.org_id)));
CREATE POLICY "Client users view posts" ON public.content_lab_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND is_client_user(auth.uid(), r.client_id)));
CREATE POLICY "Platform admins view posts" ON public.content_lab_posts FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- IDEAS
CREATE TABLE public.content_lab_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  idea_number integer NOT NULL,
  title text NOT NULL,
  hook text,
  script text,
  caption text,
  visual_direction text,
  cta text,
  hashtags text[] NOT NULL DEFAULT '{}',
  best_fit_platform text CHECK (best_fit_platform IN ('instagram','tiktok','facebook')),
  why_it_works text,
  inspired_by_post_id uuid REFERENCES public.content_lab_posts(id) ON DELETE SET NULL,
  inspiration_source text,
  status text NOT NULL DEFAULT 'new',
  edit_count integer NOT NULL DEFAULT 0,
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_lab_ideas_run ON public.content_lab_ideas(run_id);
CREATE UNIQUE INDEX idx_content_lab_ideas_run_number ON public.content_lab_ideas(run_id, idea_number);
ALTER TABLE public.content_lab_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage ideas" ON public.content_lab_ideas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND user_belongs_to_org(auth.uid(), r.org_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND user_belongs_to_org(auth.uid(), r.org_id)));
CREATE POLICY "Client users view ideas" ON public.content_lab_ideas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_lab_runs r WHERE r.id = run_id AND is_client_user(auth.uid(), r.client_id)));
CREATE POLICY "Platform admins view ideas" ON public.content_lab_ideas FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
CREATE TRIGGER trg_content_lab_ideas_updated BEFORE UPDATE ON public.content_lab_ideas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- IDEA EDITS (rate-limit ledger)
CREATE TABLE public.content_lab_idea_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.content_lab_ideas(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  edited_by uuid,
  instruction text NOT NULL,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_idea_edits_idea ON public.content_lab_idea_edits(idea_id);
CREATE INDEX idx_idea_edits_org_time ON public.content_lab_idea_edits(org_id, created_at);
ALTER TABLE public.content_lab_idea_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view idea edits" ON public.content_lab_idea_edits FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members insert idea edits" ON public.content_lab_idea_edits FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Platform admins view all idea edits" ON public.content_lab_idea_edits FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));