-- Trigger function: keep content_lab_ideas.like_count in sync with reactions
CREATE OR REPLACE FUNCTION public.sync_idea_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_lab_ideas
      SET like_count = like_count + 1, updated_at = now()
      WHERE id = NEW.idea_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_lab_ideas
      SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
      WHERE id = OLD.idea_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_idea_like_count_ins ON public.content_lab_idea_reactions;
DROP TRIGGER IF EXISTS trg_sync_idea_like_count_del ON public.content_lab_idea_reactions;

CREATE TRIGGER trg_sync_idea_like_count_ins
AFTER INSERT ON public.content_lab_idea_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_idea_like_count();

CREATE TRIGGER trg_sync_idea_like_count_del
AFTER DELETE ON public.content_lab_idea_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_idea_like_count();

-- Backfill existing counts
UPDATE public.content_lab_ideas i
SET like_count = COALESCE(c.cnt, 0)
FROM (
  SELECT idea_id, COUNT(*)::int AS cnt
  FROM public.content_lab_idea_reactions
  GROUP BY idea_id
) c
WHERE c.idea_id = i.id;
