-- ============================================
-- Fix 1: org_members — add WITH CHECK to prevent role escalation on invite acceptance
-- ============================================
DROP POLICY IF EXISTS "Users can accept own invites" ON public.org_members;

CREATE POLICY "Users can accept own invites"
ON public.org_members FOR UPDATE TO authenticated
USING (
  invited_email = user_email(auth.uid())
  AND accepted_at IS NULL
  AND user_id IS NULL
)
WITH CHECK (
  user_id = auth.uid()
  AND accepted_at IS NOT NULL
  AND role = (SELECT om.role FROM public.org_members om WHERE om.id = org_members.id)
);

-- ============================================
-- Fix 2: Column-level grants — hide token columns from authenticated role
-- ============================================
REVOKE SELECT ON public.platform_connections FROM authenticated;

GRANT SELECT (
  id, client_id, platform, account_name, account_id,
  is_connected, last_sync_at, last_sync_status, last_error,
  metadata, token_expires_at, created_at, updated_at
) ON public.platform_connections TO authenticated;

-- INSERT, UPDATE, DELETE remain at table level (unchanged)

-- ============================================
-- Fix 2b: Helper function for creating child connections without exposing tokens
-- ============================================
CREATE OR REPLACE FUNCTION public.create_child_platform_connection(
  _source_connection_id uuid,
  _client_id uuid,
  _platform platform_type,
  _account_id text,
  _account_name text,
  _direct_access_token text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _org_id uuid;
BEGIN
  -- Verify caller belongs to the org that owns this client
  SELECT c.org_id INTO _org_id FROM clients c WHERE c.id = _client_id;
  IF _org_id IS NULL OR NOT user_belongs_to_org(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO platform_connections (
    client_id, platform, is_connected, account_id, account_name,
    access_token, token_expires_at, metadata
  )
  SELECT
    _client_id, _platform, true, _account_id, _account_name,
    COALESCE(_direct_access_token, pc.access_token),
    pc.token_expires_at,
    _metadata
  FROM platform_connections pc
  WHERE pc.id = _source_connection_id
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;