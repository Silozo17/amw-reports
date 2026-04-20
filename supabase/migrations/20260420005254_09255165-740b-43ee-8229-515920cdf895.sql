ALTER TABLE public.content_lab_niches
  ADD COLUMN IF NOT EXISTS brand_brief jsonb NOT NULL DEFAULT '{}'::jsonb;