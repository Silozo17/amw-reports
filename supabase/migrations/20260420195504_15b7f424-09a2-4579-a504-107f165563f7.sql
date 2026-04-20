ALTER TABLE public.content_lab_ideas
  ADD COLUMN IF NOT EXISTS linked_post_id uuid REFERENCES public.content_lab_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_views integer,
  ADD COLUMN IF NOT EXISTS actual_likes integer,
  ADD COLUMN IF NOT EXISTS actual_comments integer,
  ADD COLUMN IF NOT EXISTS actual_engagement_rate numeric;

CREATE INDEX IF NOT EXISTS idx_content_lab_ideas_linked_post ON public.content_lab_ideas(linked_post_id);