-- 1. Add wildcard flag to ideas
ALTER TABLE public.content_lab_ideas
  ADD COLUMN IF NOT EXISTS is_wildcard boolean NOT NULL DEFAULT false;

-- 2. Backfill content_lab_posts.bucket from niche handles (lowercased, '@' stripped)
WITH niche_handles AS (
  SELECT
    r.id AS run_id,
    LOWER(REGEXP_REPLACE(COALESCE(n.own_handle, ''), '^@', '')) AS own_h,
    ARRAY(
      SELECT LOWER(REGEXP_REPLACE(COALESCE(elem->>'handle', elem #>> '{}'), '^@', ''))
      FROM jsonb_array_elements(COALESCE(n.top_global_benchmarks, '[]'::jsonb)) elem
    ) || ARRAY(
      SELECT LOWER(REGEXP_REPLACE(COALESCE(elem->>'handle', elem #>> '{}'), '^@', ''))
      FROM jsonb_array_elements(COALESCE(n.top_competitors, '[]'::jsonb)) elem
    ) AS bench_handles
  FROM public.content_lab_runs r
  JOIN public.content_lab_niches n ON n.id = r.niche_id
)
UPDATE public.content_lab_posts p
SET bucket = CASE
  WHEN nh.own_h <> '' AND LOWER(REGEXP_REPLACE(p.author_handle, '^@', '')) = nh.own_h THEN 'own'
  WHEN LOWER(REGEXP_REPLACE(p.author_handle, '^@', '')) = ANY(nh.bench_handles) THEN 'benchmark'
  ELSE 'benchmark'
END
FROM niche_handles nh
WHERE p.run_id = nh.run_id AND p.bucket IS NULL;

-- 3. Cleanup: delete failed runs, stale pending runs (>24h old), and empty runs older than 1h
WITH runs_to_delete AS (
  SELECT r.id
  FROM public.content_lab_runs r
  WHERE r.status = 'failed'
     OR (r.status = 'pending' AND r.created_at < now() - interval '24 hours')
     OR (
       NOT EXISTS (SELECT 1 FROM public.content_lab_ideas i WHERE i.run_id = r.id)
       AND NOT EXISTS (SELECT 1 FROM public.content_lab_posts po WHERE po.run_id = r.id)
       AND r.created_at < now() - interval '1 hour'
     )
)
, _del_logs AS (
  DELETE FROM public.content_lab_step_logs WHERE run_id IN (SELECT id FROM runs_to_delete) RETURNING 1
)
, _del_hooks AS (
  DELETE FROM public.content_lab_hooks WHERE run_id IN (SELECT id FROM runs_to_delete) RETURNING 1
)
, _del_trends AS (
  DELETE FROM public.content_lab_trends WHERE run_id IN (SELECT id FROM runs_to_delete) RETURNING 1
)
, _del_ideas AS (
  DELETE FROM public.content_lab_ideas WHERE run_id IN (SELECT id FROM runs_to_delete) RETURNING 1
)
, _del_posts AS (
  DELETE FROM public.content_lab_posts WHERE run_id IN (SELECT id FROM runs_to_delete) RETURNING 1
)
DELETE FROM public.content_lab_runs WHERE id IN (SELECT id FROM runs_to_delete);