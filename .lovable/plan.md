

# Admin: Full Org & User Management

## Current State

The admin panel already supports:
- Viewing all orgs and users
- Editing org names, subscriptions, member roles
- Editing user profiles, changing org assignment, resetting passwords, deactivating/deleting users

**What's missing:**
1. **Create Organisation** — no button on the org list page
2. **Delete Organisation** — no option on the org detail page
3. **Add Member to Org** — no way to link an existing user or invite someone directly from the org detail members tab
4. **RLS gaps** — platform admins cannot INSERT or DELETE on `org_members` for other orgs, and cannot INSERT or DELETE on `organisations`

## Plan

### 1. DB Migration — Add platform admin RLS policies

```sql
-- Platform admins can fully manage org_members
CREATE POLICY "Platform admins can manage all members"
ON public.org_members FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can create organisations
CREATE POLICY "Platform admins can create orgs"
ON public.organisations FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()));

-- Platform admins can delete organisations
CREATE POLICY "Platform admins can delete orgs"
ON public.organisations FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()));
```

### 2. AdminOrgList — Add "Create Organisation" button

- Dialog with name field
- On submit: insert into `organisations`, then optionally create a starter subscription
- Refresh the list after creation

### 3. AdminOrgDetail — Add "Delete Organisation" and "Add Member"

**Delete Org:**
- Destructive action with confirmation dialog
- Deletes org_members, org_subscriptions, then the organisation itself
- Redirects back to org list

**Add Member (Members tab):**
- Button next to "Members" tab header
- Dialog with: email input (to search existing users or invite), role selector
- If a user with that email exists in profiles → create `org_members` row linking them + update their `profiles.org_id`
- If no user found → create a pending invite row (like the existing invite flow)

### 4. AdminUserList — No changes needed
The edit dialog already supports changing a user's org and role, which covers "link users to organisations".

## Files

| File | Change |
|---|---|
| DB Migration | 3 new RLS policies for platform admin management |
| `src/pages/admin/AdminOrgList.tsx` | Add "Create Organisation" dialog |
| `src/pages/admin/AdminOrgDetail.tsx` | Add "Delete Organisation" button + "Add Member" dialog in members tab |

