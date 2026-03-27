

# Fix Org Switching: 3 Issues

## Issues Identified

### 1. Dashboard still shows AMW clients after switching to ReDigital
**Root cause**: The Dashboard (`Index.tsx`) queries don't filter by `orgId`. RLS uses `user_belongs_to_org()` which returns `true` for ALL orgs the user belongs to. So if you're a member of both AMW and ReDigital, RLS allows data from both — and there's no `.eq('org_id', orgId)` filter on the queries.

The previous fix only added `orgId` as a useEffect dependency (to re-fetch), but never added an actual query filter. Since RLS now allows access to multiple orgs, the queries return data from ALL orgs.

**Fix**: Add explicit `.eq('org_id', orgId)` filters to all dashboard queries in `Index.tsx`. Same issue exists for `Reports.tsx`, `Connections.tsx`, and `Logs.tsx` — queries on tables with `org_id` columns need the filter.

### 2. White Label tab not showing for ReDigital (Agency plan)
**Root cause**: `useEntitlements` fetches the subscription for the **current `orgId`** (from `useOrg`), but `useAuth` determines `isOwner` by fetching the **first** `org_members` row (`LIMIT 1`). If the user's first membership is for AMW (where they may be a manager), `isOwner` is `false` even though they're an owner of ReDigital.

Additionally, `hasWhitelabel` depends on the subscription of the selected org — if the query isn't returning the right subscription for ReDigital, the tab won't show.

**Fix**: `useAuth` should get the role for the **currently selected org**, not just `LIMIT 1`. Import `orgId` from a shared source or accept it. Since `useAuth` is a context provider that loads before `useOrg`, we need to either:
- Have `useAuth`'s `fetchProfile` accept an `orgId` and re-run when org switches, OR
- Move role determination into `useOrg` (which already knows the selected org's role via `orgRole`)

The simplest fix: `SettingsPage` should use `orgRole` from `useOrg()` instead of `isOwner`/`isManager` from `useAuth()` for org-context-sensitive checks.

### 3. Agency plan with unlimited clients not reflecting
This is likely working correctly at the DB level but the UI doesn't re-fetch `useEntitlements` when switching orgs. Since `useEntitlements` already uses `orgId` in its query key, this should work — but the dashboard/settings pages may be caching stale data. Need to verify the subscription query returns correct data for ReDigital.

## Changes

### `src/pages/Index.tsx`
- Add `.eq('org_id', orgId)` to all queries on org-scoped tables: `clients`, `reports`, `sync_logs`, `email_logs`, `platform_connections`
- Guard the fetch behind `if (!orgId) return`

### `src/pages/clients/ClientList.tsx`
- Add `.eq('org_id', orgId!)` to the clients query

### `src/pages/Reports.tsx`
- Add `.eq('org_id', orgId!)` to the reports query

### `src/pages/Connections.tsx`
- Add org filtering (connections go through clients, so filter clients by org_id first or join)

### `src/pages/Logs.tsx`
- Add `.eq('org_id', orgId!)` to sync_logs and report_logs queries

### `src/pages/SettingsPage.tsx`
- Use `orgRole` from `useOrg()` for `isOwner`/`isManager` checks instead of `useAuth()` (which only returns the role for the first org)
- This ensures White Label tab shows when the selected org has an Agency plan and the user is an owner of that org

### `src/hooks/useAuth.tsx`
- No changes needed — `isOwner`/`isManager` from useAuth can remain as a "global" role indicator, but org-specific pages should use `useOrg().orgRole`

## Files

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Add `orgId` filter to all queries, guard with `if (!orgId)` |
| `src/pages/clients/ClientList.tsx` | Add `.eq('org_id', orgId!)` to clients query |
| `src/pages/Reports.tsx` | Add `.eq('org_id', orgId!)` to reports query |
| `src/pages/Connections.tsx` | Add org_id filtering |
| `src/pages/Logs.tsx` | Add `.eq('org_id', orgId!)` to log queries |
| `src/pages/SettingsPage.tsx` | Use `useOrg().orgRole` for role checks instead of `useAuth()` |

