

# In-Platform Organisation Invites

## Problem
Existing users cannot see or act on org invites inside the app — invites only work via the `handle_new_user` trigger on signup.

## Plan

### 1. DB Migration — RLS policies on `org_members` for invite recipients

Add 3 new policies using a security definer function to avoid recursion:

```sql
-- Security definer function to get current user's email
CREATE OR REPLACE FUNCTION public.user_email(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- SELECT: see invites addressed to you
CREATE POLICY "Users can view own invites" ON org_members
FOR SELECT TO authenticated
USING (invited_email = user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);

-- UPDATE: accept invite
CREATE POLICY "Users can accept own invites" ON org_members
FOR UPDATE TO authenticated
USING (invited_email = user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);

-- DELETE: decline invite
CREATE POLICY "Users can decline own invites" ON org_members
FOR DELETE TO authenticated
USING (invited_email = user_email(auth.uid()) AND accepted_at IS NULL AND user_id IS NULL);
```

### 2. New hook — `src/hooks/useInvites.ts`

- Query `org_members` where `invited_email` matches current user email, `accepted_at IS NULL`, `user_id IS NULL`
- Join with `organisations` to get org name/logo for display
- `acceptInvite(id)`: update row → set `user_id = auth.uid()`, `accepted_at = now()`; then call `refetchOrg()`
- `declineInvite(id)`: delete the row

### 3. UI — Bell icon in `src/components/layout/AppSidebar.tsx`

- Add a `Bell` icon with badge count near the user menu area (above the user dropdown)
- Clicking opens a `Popover` listing pending invites showing org name, role, and Accept/Decline buttons
- On accept, trigger `refetchOrg()` so the org switcher updates immediately
- Hide bell entirely when no pending invites exist

## Files

| File | Change |
|---|---|
| DB Migration | Add `user_email()` function + 3 RLS policies on `org_members` |
| `src/hooks/useInvites.ts` | New hook: fetch pending invites, accept, decline |
| `src/components/layout/AppSidebar.tsx` | Add bell icon with invite notification popover |

