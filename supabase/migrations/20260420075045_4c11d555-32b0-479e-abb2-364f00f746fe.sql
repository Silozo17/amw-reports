ALTER TABLE public.content_lab_verticals
  ADD COLUMN IF NOT EXISTS min_posts_floor integer NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.content_lab_verticals.min_posts_floor IS
  'Per-vertical minimum number of verified benchmark posts required before ideation runs. Pipeline enforces a global hard minimum of 8 in code regardless of this value.';