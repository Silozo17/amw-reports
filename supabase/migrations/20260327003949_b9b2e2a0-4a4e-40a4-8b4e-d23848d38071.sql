-- Platform admins can fully manage org_members (insert, update, delete)
CREATE POLICY "Platform admins can manage all members"
ON public.org_members FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can create organisations
CREATE POLICY "Platform admins can create orgs"
ON public.organisations FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can delete organisations
CREATE POLICY "Platform admins can delete orgs"
ON public.organisations FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()));