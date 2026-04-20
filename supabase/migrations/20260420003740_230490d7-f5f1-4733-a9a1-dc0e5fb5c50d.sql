ALTER TABLE public.content_lab_posts
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS mentions text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS music_title text,
  ADD COLUMN IF NOT EXISTS music_artist text,
  ADD COLUMN IF NOT EXISTS tagged_users text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.content_lab_niches
  ADD COLUMN IF NOT EXISTS media_types text[] NOT NULL DEFAULT ARRAY['reel']::text[];