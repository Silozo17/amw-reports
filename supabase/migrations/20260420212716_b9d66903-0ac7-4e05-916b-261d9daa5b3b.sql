CREATE OR REPLACE FUNCTION public.get_global_hook_library(
  _niche text DEFAULT NULL,
  _platform text DEFAULT NULL,
  _mechanism text DEFAULT NULL,
  _limit int DEFAULT 200
) RETURNS TABLE (
  id uuid,
  hook_text text,
  mechanism text,
  why_it_works text,
  niche_label text,
  platform text,
  author_handle text,
  source_views int,
  source_engagement_rate numeric,
  performance_score numeric,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id,
         h.hook_text,
         h.mechanism,
         h.why_it_works,
         n.label AS niche_label,
         p.platform::text AS platform,
         p.author_handle,
         p.views AS source_views,
         p.engagement_rate AS source_engagement_rate,
         ROUND((LN(GREATEST(COALESCE(p.views, 1), 1)) * (1 + COALESCE(p.engagement_rate, 0)))::numeric, 2) AS performance_score,
         h.created_at
  FROM public.content_lab_hooks h
  JOIN public.content_lab_runs r ON r.id = h.run_id AND r.status = 'completed'
  LEFT JOIN public.content_lab_posts p ON p.id = h.source_post_id
  LEFT JOIN public.content_lab_niches n ON n.id = r.niche_id
  WHERE h.hook_text IS NOT NULL
    AND (_niche IS NULL OR n.label ILIKE _niche)
    AND (_platform IS NULL OR p.platform::text = _platform)
    AND (_mechanism IS NULL OR h.mechanism = _mechanism)
  ORDER BY performance_score DESC NULLS LAST, h.created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_hook_library(text, text, text, int) TO authenticated;