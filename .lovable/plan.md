

# Set Default Organisation on Login

## What it does

Adds a "Default Organisation" dropdown to the Account settings. When you log in, the app opens this org instead of whichever one was last used on that device. The setting is stored in the database so it works across all devices.

## Implementation

### 1. Database migration — add `default_org_id` to `profiles`

Add a nullable `uuid` column `default_org_id` to the `profiles` table. No foreign key needed (consistent with existing pattern). Default is `NULL`, meaning "use existing behaviour" (last-used org from localStorage).

### 2. Update `AccountSection.tsx` — add Default Org picker

- Import `useOrg` to access `allMemberships`
- Add a `Select` dropdown listing all orgs the user belongs to, plus an "Auto (last used)" option
- On save, include `default_org_id` in the profile update call

### 3. Update `OrgContext.tsx` — respect default org on initial load

In `fetchOrg`, when determining `targetOrgId`:
- Fetch the user's profile `default_org_id`
- Priority order: `overrideOrgId` → `localStorage` (only if already set this session) → `default_org_id` from profile → first membership
- On first login (no localStorage value yet), `default_org_id` takes effect

## Files modified

| File | Change |
|---|---|
| Migration | `ALTER TABLE profiles ADD COLUMN default_org_id uuid` |
| `src/components/settings/AccountSection.tsx` | Add Default Org dropdown using `allMemberships` |
| `src/contexts/OrgContext.tsx` | Check `profile.default_org_id` as fallback before first membership |

