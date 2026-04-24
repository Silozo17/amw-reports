
ALTER TABLE public.content_lab_ideas
  ADD COLUMN IF NOT EXISTS hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.content_lab_idea_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.content_lab_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, user_id)
);

ALTER TABLE public.content_lab_idea_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members and client users view reactions"
  ON public.content_lab_idea_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_ideas i
    JOIN public.content_lab_runs r ON r.id = i.run_id
    WHERE i.id = content_lab_idea_reactions.idea_id
      AND (public.user_belongs_to_org(auth.uid(), r.org_id)
        OR public.is_client_user(auth.uid(), r.client_id))
  ));

CREATE POLICY "Users insert own reactions"
  ON public.content_lab_idea_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.content_lab_ideas i
    JOIN public.content_lab_runs r ON r.id = i.run_id
    WHERE i.id = content_lab_idea_reactions.idea_id
      AND (public.user_belongs_to_org(auth.uid(), r.org_id)
        OR public.is_client_user(auth.uid(), r.client_id))
  ));

CREATE POLICY "Users delete own reactions"
  ON public.content_lab_idea_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.content_lab_idea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.content_lab_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_lab_idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members and client users view comments"
  ON public.content_lab_idea_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.content_lab_ideas i
    JOIN public.content_lab_runs r ON r.id = i.run_id
    WHERE i.id = content_lab_idea_comments.idea_id
      AND (public.user_belongs_to_org(auth.uid(), r.org_id)
        OR public.is_client_user(auth.uid(), r.client_id))
  ));

CREATE POLICY "Users insert own comments"
  ON public.content_lab_idea_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.content_lab_ideas i
    JOIN public.content_lab_runs r ON r.id = i.run_id
    WHERE i.id = content_lab_idea_comments.idea_id
      AND (public.user_belongs_to_org(auth.uid(), r.org_id)
        OR public.is_client_user(auth.uid(), r.client_id))
  ));

CREATE POLICY "Users delete own comments"
  ON public.content_lab_idea_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.content_lab_idea_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.content_lab_ideas(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_lab_idea_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage idea share tokens"
  ON public.content_lab_idea_share_tokens FOR ALL TO authenticated
  USING (public.user_belongs_to_org(auth.uid(), org_id))
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

-- Public, sanitized read of a shared idea
CREATE OR REPLACE FUNCTION public.get_shared_idea(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _idea record;
  _org record;
  _result jsonb;
BEGIN
  SELECT i.*, r.org_id AS r_org_id
  INTO _idea
  FROM public.content_lab_idea_share_tokens t
  JOIN public.content_lab_ideas i ON i.id = t.idea_id
  JOIN public.content_lab_runs r ON r.id = i.run_id
  WHERE t.slug = _slug AND t.is_active = true;

  IF _idea IS NULL THEN RETURN NULL; END IF;

  SELECT id, name, logo_url, primary_color, accent_color, heading_font, body_font
  INTO _org FROM public.organisations WHERE id = _idea.r_org_id;

  UPDATE public.content_lab_idea_share_tokens
  SET view_count = view_count + 1
  WHERE slug = _slug;

  _result := jsonb_build_object(
    'idea', jsonb_build_object(
      'id', _idea.id,
      'title', _idea.title,
      'hook', _idea.hook,
      'hooks', _idea.hooks,
      'caption', _idea.caption,
      'script', _idea.script,
      'cta', _idea.cta,
      'hashtags', _idea.hashtags,
      'best_fit_platform', _idea.best_fit_platform,
      'why_it_works', _idea.why_it_works,
      'visual_direction', _idea.visual_direction,
      'like_count', _idea.like_count
    ),
    'org', to_jsonb(_org)
  );
  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_idea(text) TO anon, authenticated;
