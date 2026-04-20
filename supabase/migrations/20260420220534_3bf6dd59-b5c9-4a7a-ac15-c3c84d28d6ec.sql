-- Unique index for idempotent hook upserts
CREATE UNIQUE INDEX IF NOT EXISTS content_lab_hooks_run_text_uniq
  ON public.content_lab_hooks (run_id, lower(hook_text));

-- 1. Backfill from scraped posts (completed runs only)
INSERT INTO public.content_lab_hooks (run_id, hook_text, mechanism, why_it_works, source_post_id, engagement_score)
SELECT p.run_id,
       p.hook_text,
       NULLIF(p.hook_type, ''),
       NULL::text,
       p.id,
       p.engagement_rate
FROM public.content_lab_posts p
JOIN public.content_lab_runs r ON r.id = p.run_id AND r.status = 'completed'
WHERE p.hook_text IS NOT NULL AND btrim(p.hook_text) <> ''
ON CONFLICT (run_id, lower(hook_text)) DO NOTHING;

-- 2a. Backfill primary hooks from generated ideas (completed runs only)
INSERT INTO public.content_lab_hooks (run_id, hook_text, mechanism, why_it_works, source_post_id, engagement_score)
SELECT i.run_id,
       i.hook,
       'unknown',
       i.why_it_works,
       i.based_on_post_id,
       NULL::numeric
FROM public.content_lab_ideas i
JOIN public.content_lab_runs r ON r.id = i.run_id AND r.status = 'completed'
WHERE i.hook IS NOT NULL AND btrim(i.hook) <> ''
ON CONFLICT (run_id, lower(hook_text)) DO NOTHING;

-- 2b. Backfill hook_variants entries from generated ideas
INSERT INTO public.content_lab_hooks (run_id, hook_text, mechanism, why_it_works, source_post_id, engagement_score)
SELECT i.run_id,
       v->>'text',
       NULLIF(v->>'mechanism', ''),
       v->>'why',
       i.based_on_post_id,
       NULL::numeric
FROM public.content_lab_ideas i
JOIN public.content_lab_runs r ON r.id = i.run_id AND r.status = 'completed'
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(i.hook_variants, '[]'::jsonb)) AS v
WHERE (v->>'text') IS NOT NULL AND btrim(v->>'text') <> ''
ON CONFLICT (run_id, lower(hook_text)) DO NOTHING;