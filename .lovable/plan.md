

## Fix Four Security Findings

### Finding 1: invite-org-member Role Escalation
**Problem**: Any org member (including managers) can invite users with the `owner` role.
**Fix**: In `invite-org-member/index.ts`, after fetching the caller's membership, enforce that only owners can invite as `owner`. If a manager tries to set `role: "owner"`, reject with 403.

### Finding 2: OAuth Tokens Readable by All Org Members
**Problem**: `platform_connections` SELECT policies expose `access_token` and `refresh_token` to all org members.
**Fix**: Create a database view `platform_connections_safe` that excludes token columns, and update the two non-admin SELECT policies to use a restrictive approach. Since Postgres RLS cannot restrict column-level access, we will instead:
- Create a migration that drops the two permissive SELECT policies for org members and client users
- Replace them with policies on a new `platform_connections_visible` view (excluding token columns), OR
- Simpler: use a **security definer function** that returns connection data without tokens, and have the frontend call that instead

**Actually**, the simplest correct fix: keep the table policies but add a **database view** `platform_connections_safe` (without token columns) and update all frontend queries to use the view. The raw table remains accessible only via the ALL policy (for writes) and admin SELECT.

Wait — RLS on views requires the underlying table policies. The cleanest approach:
- Remove `access_token` and `refresh_token` from the org-member/client-user SELECT policies is not possible with standard RLS (it's row-level, not column-level).
- **Best approach**: Create a Postgres view `platform_connections_safe` excluding sensitive columns, enable RLS on it, add SELECT policies mirroring the current ones, and update all frontend `.from("platform_connections").select(...)` calls to use the view (or explicitly never select token columns).

**Simplest approach that requires no frontend changes**: Since tokens are encrypted (AES-256-GCM with `enc:` prefix), they're not directly usable. But defense-in-depth says we should still restrict. We'll:
1. Create a migration adding a security definer function `get_safe_connections(uuid)` that returns connection data without tokens
2. Actually even simpler — just update the frontend to never SELECT token columns. But that doesn't fix the RLS issue.

**Final decision**: Create a `platform_connections_safe` view excluding token columns, with its own RLS policies for org members and client users. Drop the SELECT-only policies on the raw table for org members and client users (keep the ALL policy for org members which they need for writes, and keep admin policies). Frontend queries that only read connections will use the view.

Let me check what frontend queries look like.

### Finding 3: backfill-sync No Auth
**Problem**: No JWT verification — anyone can call it.
**Fix**: Add JWT authentication + verify the user belongs to the org that owns the connection. Since it's also called server-to-server from `scheduled-sync` (which uses service role key), we need to allow both: service-role calls bypass auth, authenticated user calls verify org membership.

### Finding 4: org_members UPDATE Policy Missing WITH CHECK
**Problem**: The "Users can accept own invites" UPDATE policy has no WITH CHECK, allowing invited users to set `role` or other fields.
**Fix**: Add a WITH CHECK condition that restricts updates to only setting `user_id = auth.uid()` and `accepted_at = now()`, ensuring `role` cannot be changed.

---

### Implementation Plan

#### Migration SQL
1. **org_members**: Replace the "Users can accept own invites" UPDATE policy with one that includes a WITH CHECK restricting `role` to remain unchanged and `user_id` to `auth.uid()`
2. **platform_connections**: Create a `platform_connections_safe` view and add SELECT policies; drop org-member and client-user SELECT policies on the raw table

#### Edge Function Changes
3. **invite-org-member/index.ts**: Add role validation — only owners can invite as owner; managers can only invite as manager
4. **backfill-sync/index.ts**: Add JWT authentication with service-role bypass

#### Frontend Changes
5. Update all `supabase.from("platform_connections").select(...)` read queries to use the safe view (need to check which files do this)

---

### Technical Details

**Migration (1 migration file):**
```sql
-- Fix 1: Restrict org_members update
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

-- Fix 2: Safe view for platform connections
CREATE VIEW public.platform_connections_safe AS
SELECT id, client_id, platform, account_name, account_id,
       is_connected, last_sync_at, last_sync_status, last_error,
       metadata, token_expires_at, created_at, updated_at
FROM public.platform_connections;

-- RLS on the view not possible in standard Postgres,
-- so we use security definer function instead
-- OR we keep the view and rely on underlying table RLS

-- Actually: drop SELECT-only policies on raw table for non-admins
DROP POLICY IF EXISTS "Org members can view connections" ON public.platform_connections;
DROP POLICY IF EXISTS "Client users can view own connections" ON public.platform_connections;

-- The "Org members can manage connections" ALL policy still grants SELECT.
-- We need to change it to only cover INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Org members can manage connections" ON public.platform_connections;

CREATE POLICY "Org members can manage connections"
ON public.platform_connections FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = platform_connections.client_id
  AND user_belongs_to_org(auth.uid(), c.org_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM clients c
  WHERE c.id = platform_connections.client_id
  AND user_belongs_to_org(auth.uid(), c.org_id)
));
```

Hmm, the ALL policy still grants SELECT with all columns. There's no way in Postgres RLS to restrict columns. The only real fix is either:
- A view (but views inherit underlying table RLS, so if the ALL policy allows SELECT, the view doesn't help)
- A security definer function
- Column-level grants (REVOKE SELECT on specific columns)

**Column-level grants** is the correct Postgres approach:
```sql
REVOKE SELECT ON public.platform_connections FROM authenticated;
GRANT SELECT (id, client_id, platform, ...) ON public.platform_connections TO authenticated;
-- Grant all columns to service_role (edge functions)
```

But this conflicts with the ALL policy. Let me think...

Actually the cleanest: **REVOKE column-level access** for `access_token` and `refresh_token` from the `authenticated` role. Service role bypasses RLS and column grants entirely.

```sql
REVOKE ALL ON public.platform_connections FROM authenticated;
GRANT SELECT (id, client_id, platform, account_name, account_id, is_connected, 
              last_sync_at, last_sync_status, last_error, metadata, 
              token_expires_at, created_at, updated_at) 
ON public.platform_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_connections TO authenticated;
```

This means authenticated users can never SELECT token columns, regardless of RLS. Edge functions using service_role key are unaffected. This is the simplest fix with zero frontend changes needed (as long as frontend queries don't select token columns).

Let me verify frontend doesn't select tokens.

Let me finalize the plan now — I have enough info.

---

### Revised Plan (4 fixes)

**1. Migration — org_members WITH CHECK** (Finding 4)
Add WITH CHECK to prevent role escalation during invite acceptance.

**2. Migration — Column-level grants on platform_connections** (Finding 2)  
Revoke SELECT on `access_token` and `refresh_token` columns from the `authenticated` role.

**3. Edge function — invite-org-member role check** (Finding 1)
Only owners can assign `owner` role.

**4. Edge function — backfill-sync auth** (Finding 3)
Add JWT verification with service-role bypass.

**Files modified (2):** `invite-org-member/index.ts`, `backfill-sync/index.ts`
**Files created (1):** Migration SQL

### Risk Assessment
- Column-level grants: if any frontend query does `select("*")` on platform_connections and includes token columns, it will fail. Need to verify.
- The `handle_new_user` trigger and edge functions use service_role, so they're unaffected by column grants.
- `useInvites.ts` UPDATE sets `user_id` and `accepted_at` — compatible with the new WITH CHECK.
