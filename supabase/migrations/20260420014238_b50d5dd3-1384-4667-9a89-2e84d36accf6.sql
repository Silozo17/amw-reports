-- Add unique constraint for benchmark pool upsert key
ALTER TABLE public.content_lab_benchmark_pool
ADD CONSTRAINT content_lab_benchmark_pool_unique
UNIQUE (niche_tag, platform, handle);

-- Helper: slugify a niche label into a niche_tag
CREATE OR REPLACE FUNCTION public.slugify_niche_tag(_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(regexp_replace(coalesce(_label, ''), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
$$;