
-- Security definer function to get current user's email from profiles
CREATE OR REPLACE FUNCTION public.user_email(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- SELECT: users can see invites addressed to their email
CREATE POLICY "Users can view own invites" ON public.org_members
FOR SELECT TO authenticated
USING (invited_email = public.user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);

-- UPDATE: users can accept invites addressed to their email
CREATE POLICY "Users can accept own invites" ON public.org_members
FOR UPDATE TO authenticated
USING (invited_email = public.user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);

-- DELETE: users can decline invites addressed to their email
CREATE POLICY "Users can decline own invites" ON public.org_members
FOR DELETE TO authenticated
USING (invited_email = public.user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);

-- Also need SELECT on organisations for invitees to see org name/logo
CREATE POLICY "Invitees can view invited org" ON public.organisations
FOR SELECT TO authenticated
USING (id IN (
  SELECT org_id FROM public.org_members
  WHERE invited_email = public.user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL
));
