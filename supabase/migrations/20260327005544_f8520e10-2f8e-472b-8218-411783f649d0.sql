CREATE POLICY "Platform admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));