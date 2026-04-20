CREATE TABLE public.content_lab_idea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL,
  org_id uuid NOT NULL,
  author_user_id uuid,
  author_client_user_id uuid,
  author_label text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_idea_comments_idea_id ON public.content_lab_idea_comments(idea_id, created_at DESC);
CREATE INDEX idx_idea_comments_org_id ON public.content_lab_idea_comments(org_id);

ALTER TABLE public.content_lab_idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view idea comments"
ON public.content_lab_idea_comments FOR SELECT TO authenticated
USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "Org members can insert idea comments"
ON public.content_lab_idea_comments FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_org(auth.uid(), org_id) AND author_user_id = auth.uid());

CREATE POLICY "Authors can update own comments"
ON public.content_lab_idea_comments FOR UPDATE TO authenticated
USING (author_user_id = auth.uid() OR author_client_user_id = auth.uid());

CREATE POLICY "Authors can delete own comments"
ON public.content_lab_idea_comments FOR DELETE TO authenticated
USING (author_user_id = auth.uid() OR author_client_user_id = auth.uid());

CREATE POLICY "Client users can view idea comments"
ON public.content_lab_idea_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM content_lab_ideas i
  JOIN content_lab_runs r ON r.id = i.run_id
  WHERE i.id = content_lab_idea_comments.idea_id
    AND is_client_user(auth.uid(), r.client_id)
));

CREATE POLICY "Client users can insert idea comments"
ON public.content_lab_idea_comments FOR INSERT TO authenticated
WITH CHECK (
  author_client_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM content_lab_ideas i
    JOIN content_lab_runs r ON r.id = i.run_id
    WHERE i.id = content_lab_idea_comments.idea_id
      AND is_client_user(auth.uid(), r.client_id)
      AND r.org_id = content_lab_idea_comments.org_id
  )
);

CREATE POLICY "Platform admins can view all idea comments"
ON public.content_lab_idea_comments FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE TRIGGER update_idea_comments_updated_at
BEFORE UPDATE ON public.content_lab_idea_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();