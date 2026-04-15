

# Fix: Token Exposure and User Roles Visibility

## Finding 1: OAuth tokens readable by org members

**Current state**: The `platform_connections` table has `access_token` and `refresh_token` columns that are technically readable via the org-member SELECT policy. However, the frontend already excludes these columns from all queries (every `.select()` call explicitly lists columns without tokens). Tokens are only read by edge functions using the service role key.

**Fix**: Use a Postgres column-level security approach — create a database view that excludes token columns, then restrict the SELECT policies to use this pattern. However, the simplest and most effective fix is to use **column-level grants**: revoke SELECT on the token columns from the `authenticated` role so even if someone crafts a manual query, they cannot read them.

**Migration SQL**:
```sql
-- Revoke SELECT on sensitive token columns from authenticated role
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM anon;
```

This is non-breaking because:
- No frontend query selects these columns
- Edge functions use the service role key (which bypasses RLS and column grants)
- The columns remain writable for edge functions

## Finding 2: All authenticated users can read every user's roles

**Current state**: The `user_roles` table policy uses `USING (true)`, letting any authenticated user see all role assignments. This table is used by `is_platform_admin()` and `has_role()` functions (both `SECURITY DEFINER`), so the policy isn't needed for those checks.

**Fix**: Restrict SELECT to own roles only.

**Migration SQL**:
```sql
DROP POLICY "Authenticated can view roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

This is safe because:
- `is_platform_admin()` and `has_role()` are `SECURITY DEFINER` — they bypass RLS
- No frontend code queries `user_roles` directly (only referenced in auto-generated types)

## Summary

| Change | Risk | Impact |
|--------|------|--------|
| Revoke token column SELECT | Very low | No frontend reads these columns |
| Restrict user_roles SELECT | Very low | SECURITY DEFINER functions unaffected |

**Files**: One new migration file. No application code changes needed.

