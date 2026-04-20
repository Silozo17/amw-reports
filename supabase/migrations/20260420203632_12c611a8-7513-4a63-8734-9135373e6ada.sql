-- Milestone A: Swipe File (org-shared)
CREATE TABLE public.content_lab_swipe_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  niche_id uuid REFERENCES public.content_lab_niches(id) ON DELETE SET NULL,
  idea_id uuid NOT NULL REFERENCES public.content_lab_ideas(id) ON DELETE CASCADE,
  saved_by_user_id uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  UNIQUE (org_id, idea_id)
);
CREATE INDEX idx_swipe_org ON public.content_lab_swipe_file(org_id);
CREATE INDEX idx_swipe_idea ON public.content_lab_swipe_file(idea_id);
ALTER TABLE public.content_lab_swipe_file ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view swipe file"
  ON public.content_lab_swipe_file FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can insert swipe file"
  ON public.content_lab_swipe_file FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND saved_by_user_id = auth.uid());
CREATE POLICY "Org members can update swipe file"
  ON public.content_lab_swipe_file FOR UPDATE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Org members can delete swipe file"
  ON public.content_lab_swipe_file FOR DELETE TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Platform admins can view all swipe file"
  ON public.content_lab_swipe_file FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Pattern insights cache (24h)
CREATE TABLE public.content_lab_swipe_insights (
  org_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  pattern_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  ideas_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.content_lab_swipe_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view insights"
  ON public.content_lab_swipe_insights FOR SELECT TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id));
CREATE POLICY "Platform admins manage insights"
  ON public.content_lab_swipe_insights FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- Milestone B: Run share tokens (public read-only)
CREATE TABLE public.content_lab_run_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.content_lab_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  client_logo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX idx_run_share_slug ON public.content_lab_run_share_tokens(slug);
ALTER TABLE public.content_lab_run_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage run share tokens"
  ON public.content_lab_run_share_tokens FOR ALL TO authenticated
  USING (user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (user_belongs_to_org(auth.uid(), org_id));

-- Public lookup function (anon-safe; only returns active tokens)
CREATE OR REPLACE FUNCTION public.get_shared_run(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run_id uuid;
  _org_id uuid;
  _client_logo text;
  result jsonb;
BEGIN
  SELECT t.run_id, t.org_id, t.client_logo_url
  INTO _run_id, _org_id, _client_logo
  FROM public.content_lab_run_share_tokens t
  WHERE t.slug = _slug
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
  IF _run_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'run', jsonb_build_object(
      'id', r.id,
      'summary', r.summary,
      'completed_at', r.completed_at,
      'created_at', r.created_at
    ),
    'client_name', c.company_name,
    'org_logo', COALESCE(_client_logo, o.logo_url),
    'org_primary_color', o.primary_color,
    'ideas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'hook', i.hook,
        'caption', i.caption, 'visual_direction', i.visual_direction,
        'target_platform', i.target_platform, 'is_wildcard', i.is_wildcard,
        'hashtags', i.hashtags
      ) ORDER BY i.idea_number)
      FROM public.content_lab_ideas i WHERE i.run_id = _run_id
    ), '[]'::jsonb),
    'top_posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'thumbnail_url', p.thumbnail_url, 'post_url', p.post_url,
        'author_handle', p.author_handle, 'views', p.views,
        'engagement_rate', p.engagement_rate, 'platform', p.platform
      ))
      FROM (
        SELECT * FROM public.content_lab_posts
        WHERE run_id = _run_id AND COALESCE(bucket, 'benchmark') = 'benchmark'
        ORDER BY views DESC NULLS LAST LIMIT 10
      ) p
    ), '[]'::jsonb)
  ) INTO result
  FROM public.content_lab_runs r
  JOIN public.clients c ON c.id = r.client_id
  JOIN public.organisations o ON o.id = r.org_id
  WHERE r.id = _run_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_share_view(_slug text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.content_lab_run_share_tokens
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE slug = _slug AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_run(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_share_view(text) TO anon, authenticated;