

# Fix Blank Page & Org Switching Issues

## 1. Blank Page Fix
The blank page is caused by Vite's hot-module-reload cache getting confused by the `.ts` → `.tsx` file rename. A trivial edit to `App.tsx` (e.g. adding a comment) will force a clean rebuild and resolve it immediately.

**File:** `src/App.tsx` — add a harmless comment to trigger rebuild.

## 2. Dashboard Still Leaks Cross-Org Data
In `src/pages/Index.tsx`, two `platform_connections` queries (lines 137 and 139) have **no org filter**. Since connections don't have an `org_id` column directly, they need an inner join on `clients`:

```ts
// Line 137 — disconnected count
supabase.from('platform_connections')
  .select('id, client_id, clients!inner(org_id)', { count: 'exact' })
  .eq('is_connected', false)
  .eq('clients.org_id', orgId)

// Line 139 — all connections for health
supabase.from('platform_connections')
  .select('client_id, is_connected, last_sync_at, platform, clients!inner(org_id)')
  .eq('clients.org_id', orgId)
```

**File:** `src/pages/Index.tsx`

## 3. Sidebar Shows Wrong Role for Multi-Org Users
`AppSidebar` displays `role` from `useAuth()` (line 220), which uses `LIMIT 1` on `org_members` and returns the role from whichever org was fetched first. Should use `orgRole` from `useOrg()` instead.

**File:** `src/components/layout/AppSidebar.tsx` — replace `role` from `useAuth` with `orgRole` from `useOrg`.

## 4. Remove Stale Role from `useAuth`
`useAuth` fetches `role` via `org_members` with `LIMIT 1`, which is incorrect for multi-org users. Since `useOrg` now provides `orgRole` (context-aware), `useAuth` should stop exposing `role`, `isOwner`, and `isManager` to prevent accidental misuse. Any remaining consumers should switch to `useOrg().orgRole`.

**File:** `src/hooks/useAuth.tsx` — remove `role`, `isOwner`, `isManager` fields and the `org_members` query in `fetchProfile`.
**File:** `src/components/layout/AppSidebar.tsx` — stop destructuring `role`/`isOwner` from `useAuth`.

## Files Summary

| File | Change |
|---|---|
| `src/App.tsx` | Trivial edit to force rebuild (fixes blank page) |
| `src/pages/Index.tsx` | Add org filter to 2 `platform_connections` queries |
| `src/components/layout/AppSidebar.tsx` | Use `orgRole` from `useOrg` instead of `role` from `useAuth` |
| `src/hooks/useAuth.tsx` | Remove stale `role`/`isOwner`/`isManager` (org_members LIMIT 1 query) |

