-- Saved items library (ideas / posts / hooks) per org
CREATE TABLE public.content_lab_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  saved_by uuid,
  kind text NOT NULL CHECK (kind IN ('idea','post','hook')),
  source_run_id uuid,
  source_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_saves_org ON public.content_lab_saves (org_id, created_at DESC);
CREATE INDEX idx_content_lab_saves_kind ON public.content_lab_saves (org_id, kind);

ALTER TABLE public.content_lab_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage saves"
  ON public.content_lab_saves FOR ALL TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins view all saves"
  ON public.content_lab_saves FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Hook library (deduped per org)
CREATE TABLE public.content_lab_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  saved_by uuid,
  hook_text text NOT NULL,
  hook_type text,
  platform text,
  source_post_id uuid,
  example_caption text,
  example_post_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, hook_text)
);

CREATE INDEX idx_content_lab_hooks_org ON public.content_lab_hooks (org_id, created_at DESC);

ALTER TABLE public.content_lab_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage hooks"
  ON public.content_lab_hooks FOR ALL TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins view all hooks"
  ON public.content_lab_hooks FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Trends library (auto-seeded by run pipeline + manual saves)
CREATE TABLE public.content_lab_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  saved_by uuid,
  label text NOT NULL,
  description text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_lab_trends_org ON public.content_lab_trends (org_id, created_at DESC);

ALTER TABLE public.content_lab_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage trends"
  ON public.content_lab_trends FOR ALL TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Platform admins view all trends"
  ON public.content_lab_trends FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_content_lab_trends_updated_at
  BEFORE UPDATE ON public.content_lab_trends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();