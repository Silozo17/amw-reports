-- Finding 1: Revoke SELECT on sensitive token columns from authenticated/anon roles
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM anon;

-- Finding 2: Restrict user_roles SELECT to own roles only
DROP POLICY "Authenticated can view roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());