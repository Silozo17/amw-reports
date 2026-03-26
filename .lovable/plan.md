

# Fix "Organisation Not Found" and Client Creation Errors

## Root Cause

The `ClientForm` component destructures `orgId` from `useOrg()` but **does not check `isLoading`**. If the user submits the form before the org membership query completes, `orgId` is still `null` and the guard at line 127 fires the "Organisation not found" toast.

This is a **race condition**, not a data issue — the org and membership exist in the database, but the async fetch hasn't resolved yet at the time of submission.

## Fix

### 1. `src/pages/clients/ClientForm.tsx`
- Destructure `isLoading: isOrgLoading` from `useOrg()` alongside `orgId`
- Disable the submit button while `isOrgLoading` is true (same as `isSubmitting`)
- Move the `!orgId` guard **after** confirming org has finished loading, so it only fires for genuinely missing orgs

### 2. `src/hooks/useOrg.ts`
- Add error logging when the `org_members` or `organisations` queries fail, so future issues surface in the console instead of silently returning null
- Ensure `isLoading` is only set to `false` after both queries complete (currently correct, but add a `finally` to guard against thrown errors leaving `isLoading` stuck at `true`)

### 3. No database or RLS changes needed
The existing RLS policies are correct:
- `org_members` SELECT uses `user_org_id(auth.uid())` via SECURITY DEFINER — no recursion
- `clients` INSERT uses `org_id = user_org_id(auth.uid())` — correct
- `organisations` SELECT uses `id = user_org_id(auth.uid())` — correct

| File | Change |
|------|--------|
| `src/pages/clients/ClientForm.tsx` | Use `isLoading` from `useOrg`, disable submit while loading |
| `src/hooks/useOrg.ts` | Add error logging and `finally` block for robustness |

