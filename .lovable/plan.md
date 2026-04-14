

## Fix: Connections Not Visible After Column-Level Grant

### Problem
The migration revoked full `SELECT` on `platform_connections` and only granted SELECT on specific safe columns. All frontend queries using `.select('*')` now fail silently because `*` includes `access_token` and `refresh_token` — columns the `authenticated` role can no longer read.

### Solution
Replace every `.select('*')` on `platform_connections` with an explicit column list excluding token columns. Also update the `PlatformConnection` interface to make token fields optional (they'll always be `null`/absent from frontend queries now).

### Safe column list
```
id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at
```

### Files to change

**1. `src/types/database.ts`** (lines 134-135)
- Make `access_token` and `refresh_token` optional or remove them from the interface since they're never returned to the frontend anymore.

**2. `src/pages/clients/ClientDetail.tsx`** — 4 occurrences of `.select('*')`
- Line 97: `.select('*')` → `.select('id, client_id, platform, account_name, account_id, is_connected, last_sync_at, last_sync_status, last_error, metadata, token_expires_at, created_at, updated_at')`
- Line 123: same replacement
- Line 172: same replacement
- Line 285: same replacement

**3. `src/pages/ClientPortalAuth.tsx`** — 2 occurrences
- Line 75: same replacement
- Line 150: same replacement

**4. `src/pages/admin/AdminOrgDetail.tsx`** — 1 occurrence
- Line 74: same replacement

**5. `src/pages/DebugConsole.tsx`** — 1 occurrence
- Line 99: same replacement

### What this does NOT change
- No migration needed — the column grants are correct and working as intended
- No component logic, props, or behaviour changes
- Edge functions using service role are unaffected
- The `useClientDashboard.ts` query already uses explicit columns — no change needed

