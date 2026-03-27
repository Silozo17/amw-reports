

# Fix Client Creation Bug & Add Organisation Switcher

## Problem Analysis

**Root cause of "cannot add clients"**: The test user (`test@test.com`) and 3 other users have **no `org_members` record**. The `user_org_id()` database function returns `NULL` for them, which means:
- Every RLS policy that checks `org_id = user_org_id(auth.uid())` blocks all operations
- The `useOrg` hook's recovery path creates a **brand new org** instead of linking to their existing one, making the problem worse

Current state of affected users:

```text
User                              | profile.org_id       | org_members record
----------------------------------+----------------------+-------------------
test@test.com                     | AMW Media (exists)   | MISSING
ms@redigital.dk                   | NULL                 | MISSING
piotrsolarsolarski@gmail.com      | NULL                 | MISSING
k.hejmanowski@yahoo.co.uk        | NULL                 | MISSING
```

**Org switcher**: Currently no UI or data model supports switching between multiple orgs for a single user.

---

## Plan

### 1. Data Fix — Insert missing `org_members` records (DB Migration)

For the test user who already has `profiles.org_id` set to AMW Media: insert an `org_members` row linking them as `manager` to that org.

For the 3 users with NULL org_id: the `useOrg` recovery path will handle creating orgs for them on next login (this already works once the membership exists).

### 2. Fix `useOrg` recovery logic (`src/hooks/useOrg.ts`)

Update the recovery path so that when no `org_members` record is found, it first checks if `profiles.org_id` is set. If so, it creates a membership for that existing org (as `manager`) instead of creating a brand new org. Only create a new org if `profiles.org_id` is also NULL.

### 3. Add Organisation Switcher to Sidebar (`src/components/layout/AppSidebar.tsx`)

- Query all orgs the user belongs to via `org_members`
- If the user has access to more than one org, render a dropdown in the sidebar header area (where the org name/logo currently sits) allowing them to switch
- Switching sets a `selectedOrgId` in `useOrg` context/state, which overrides the default first-org fetch
- Requires updating `useOrg` to accept an override and exposing a `switchOrg` function

### 4. Update `useOrg` for multi-org support (`src/hooks/useOrg.ts`)

- Fetch ALL `org_members` records for the user (not just first)
- Expose `orgs: OrgMembership[]` list
- Store selected org in `localStorage` for persistence across reloads
- Add `switchOrg(orgId: string)` function

---

## Files to Modify

| File | Change |
|---|---|
| DB Migration | Insert missing `org_members` row for test user |
| `src/hooks/useOrg.ts` | Fix recovery logic; add multi-org support with `switchOrg` |
| `src/components/layout/AppSidebar.tsx` | Add org switcher dropdown in header |

