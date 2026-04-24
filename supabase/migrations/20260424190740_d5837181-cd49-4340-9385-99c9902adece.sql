ALTER TABLE public.content_lab_posts
  ADD COLUMN IF NOT EXISTS media_kind text;

COMMENT ON COLUMN public.content_lab_posts.media_kind IS 'video | photo | carousel — used by UI to decide whether to show view counts';