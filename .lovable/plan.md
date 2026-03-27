

# Fix Org Switching — Data Isolation per Selected Org

## Problem
Two issues prevent org switching from working:

1. **RLS blocks multi-org access**: The `user_org_id()` function returns only the FIRST org a user belongs to. So if a user is in Org A and Org B, and `user_org_id()` returns Org A, all RLS policies block access to Org B's data entirely — even when the user selects Org B in the UI.

2. **Pages don't filter by selected org or re-fetch on switch**: Most pages (`ClientList`, `Dashboard`, `Reports`, `Connections`, `Logs`) run their queries once on mount with no `orgId` filter and no dependency on the selected org.

## Fix

### 1. Database: Allow access to ALL orgs a user belongs to

Create a new security definer function and update RLS policies on all tenant-scoped tables.

```sql
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;
```

Update RLS on these tables to replace `org_id = user_org_id(auth.uid())` with `user_belongs_to_org(auth.uid(), org_id)` (and for joined tables, the equivalent):
- `clients` (SELECT, INSERT, UPDATE, DELETE)
- `client_share_tokens` (ALL)
- `email_logs` (ALL, SELECT)
- `org_members` (SELECT, ALL for owners)
- `org_subscriptions` (SELECT, INSERT)
- `organisations` (SELECT, UPDATE)
- `report_logs` (INSERT, SELECT)
- `reports` (ALL, SELECT)
- `sync_logs` (DELETE, INSERT, SELECT)
- `custom_domains` (SELECT, ALL)

Tables using client joins (`client_platform_config`, `client_recipients`, `monthly_snapshots`, `platform_connections`) already resolve through the `clients` table, so fixing `clients` RLS cascades to them.

Also update `is_org_owner` to accept an org_id parameter (or create `is_org_owner_of`) since an owner of Org A shouldn't have owner privileges on Org B.

### 2. Client-side: Filter by `orgId` and re-fetch on switch

**Pages to update** (add `orgId` from `useOrg()` as a filter + useEffect dependency):

| Page | Change |
|---|---|
| `src/pages/Index.tsx` (Dashboard) | Add `orgId` dep to stats fetch, no query filter needed (RLS handles it, but re-fetch is needed) |
| `src/pages/clients/ClientList.tsx` | Import `useOrg`, add `orgId` to useEffect dep array to re-fetch |
| `src/pages/Reports.tsx` | Import `useOrg`, add `orgId` to useEffect dep array to re-fetch |
| `src/pages/Connections.tsx` | Import `useOrg`, add `orgId` to useEffect dep array to re-fetch |
| `src/pages/Logs.tsx` | Import `useOrg`, add `orgId` to useEffect dep array to re-fetch |

Since RLS already filters by org membership, the main fix on the client side is simply **re-fetching when `orgId` changes**. The queries don't necessarily need explicit `.eq('org_id', orgId)` filters (RLS handles it), but adding them is good practice for clarity and performance.

### 3. `useOrg` — force page refresh on switch

The `switchOrg` function currently calls `fetchOrg(newOrgId)` which updates state. Pages need to react to the `orgId` change. This already works if pages include `orgId` in their useEffect dependency arrays.

## Files

| File | Change |
|---|---|
| DB Migration | Create `user_belongs_to_org` function; update RLS on ~10 tables |
| `src/pages/Index.tsx` | Add `useOrg` import, `orgId` as useEffect dependency |
| `src/pages/clients/ClientList.tsx` | Add `useOrg` import, `orgId` as useEffect dependency |
| `src/pages/Reports.tsx` | Add `useOrg` import, `orgId` as useEffect dependency |
| `src/pages/Connections.tsx` | Add `useOrg` import, `orgId` as useEffect dependency |
| `src/pages/Logs.tsx` | Add `useOrg` import, `orgId` as useEffect dependency |

