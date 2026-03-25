
-- 1. Create is_org_owner security definer function
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;

-- 2. Fix org_members "Owners can manage" policy (self-referencing recursion)
DROP POLICY IF EXISTS "Owners can manage org members" ON public.org_members;
CREATE POLICY "Owners can manage org members"
ON public.org_members FOR ALL TO authenticated
USING (
  org_id = public.user_org_id(auth.uid())
  AND public.is_org_owner(auth.uid())
);

-- 3. Fix organisations UPDATE policy (references org_members causing recursion)
DROP POLICY IF EXISTS "Owners can update own org" ON public.organisations;
CREATE POLICY "Owners can update own org"
ON public.organisations FOR UPDATE TO authenticated
USING (
  id = public.user_org_id(auth.uid())
  AND public.is_org_owner(auth.uid())
);
