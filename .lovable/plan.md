

# Fix: Client Creation Errors

## Root Cause Analysis

After investigating triggers, schema, RLS policies, and the client creation code, I found two issues:

### Issue 1: Error details are completely swallowed
In `ClientForm.tsx` line 136, the error from the database is caught but only a generic "Failed to create client" toast is shown. The actual error message is never logged or displayed, making it impossible to diagnose what went wrong.

### Issue 2: No guard against missing org membership
The insert uses `org_id: orgId!` (line 132) with a TypeScript non-null assertion. If `orgId` is null (user hasn't been assigned to an organisation, or the org fetch hasn't completed yet), it inserts `null` into a NOT NULL column, or fails the RLS policy (`org_id = user_org_id(auth.uid())` — null = null is false in SQL). Either way, silent failure.

No trigger issues were found — the only trigger on `clients` is `update_updated_at_column` which only fires on UPDATE, not INSERT.

## Fix — Single File Change

**`src/pages/clients/ClientForm.tsx`**

1. Add a guard before the insert: if `orgId` is falsy, show "Organisation not found — please reload" and return early
2. Show the actual database error message in the toast: `toast.error(error.message || 'Failed to create client')`
3. Add `console.error('Client creation error:', error)` so the error is visible in logs for future debugging

Same treatment for the `ClientEditDialog.tsx` — show the actual error message instead of generic "Failed to update client".

## Files

| File | Change |
|------|--------|
| `src/pages/clients/ClientForm.tsx` | Add orgId guard, show real error message, add console.error |
| `src/components/clients/ClientEditDialog.tsx` | Show real error message in toast |

