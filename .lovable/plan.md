

# Fix Org Assignment + Reorder Pricing Plans

## Issues

### 1. Org assignment doesn't stick for users
**Root cause**: Two RLS policy gaps prevent platform admins from completing org assignments:
- `profiles` table: UPDATE policy only allows `user_id = auth.uid()` — admins can't update another user's `org_id`
- `org_members` table: The INSERT policy `Users can insert own membership` requires `user_id = auth.uid()`, which blocks pending invites (where `user_id` is NULL) from being inserted by admins. The platform admin `ALL` policy should cover inserts, but the `profiles.update` still fails silently.

**Fix**: Add a new RLS policy on `profiles` allowing platform admins to UPDATE any profile.

### 2. Pricing plans not ordered smallest to biggest
The `PLANS` array and `COMPARISON_ROWS` already go Creator → Freelance → Agency (correct order). The subscription settings dropdown in the admin panel (screenshot) shows plans out of order — this comes from the DB query order.

## Changes

### DB Migration
```sql
-- Allow platform admins to update any profile
CREATE POLICY "Platform admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));
```

### `src/pages/admin/AdminOrgDetail.tsx`
- Sort the subscription plans query results by `base_price` ascending so the dropdown goes Starter → Freelance → Agency

### `src/pages/admin/AdminUserList.tsx`
- Add error handling for the `org_members` insert and `profiles` update (currently silently fails)
- Sort orgs dropdown alphabetically for consistency

## Files

| File | Change |
|---|---|
| DB Migration | Add platform admin UPDATE policy on `profiles` |
| `src/pages/admin/AdminOrgDetail.tsx` | Sort plans by `base_price` ascending in dropdown |
| `src/pages/admin/AdminUserList.tsx` | Add error checking on org membership insert/profile update |

