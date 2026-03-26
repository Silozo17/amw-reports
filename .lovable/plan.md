

# Fix: Users Can't Create Clients & Architecture Cleanup

## Root Problem

The org creation happens **client-side** during OTP verification (LandingPage.tsx lines 94-136). If anything fails (network, race condition, browser closes), the user ends up with no org and no subscription. This causes "Organisation not found" when creating clients.

The current architecture requires every client to have an `org_id`. The subscription/plan is tied to the org. This is fine architecturally, but the org creation is fragile.

## Solution: Make Org Creation Bulletproof + Add Recovery

### 1. Move org creation into the `handle_new_user` database trigger

**Migration**: Update the `handle_new_user()` function to:
- Create an organisation from `raw_user_meta_data->>'company_name'` (falls back to `full_name`)
- Create an `org_members` entry (role: owner)
- Set `profiles.org_id`
- Auto-assign the Starter plan from `subscription_plans`

This fires on `auth.users` INSERT, so even if the client crashes after signup, the org exists.

### 2. Simplify the OTP verification handler (LandingPage.tsx)

Remove all org/membership/subscription creation code from `handleVerifyOtp`. After verification, just navigate to `/onboarding`. The trigger already handled everything.

### 3. Add org recovery in Index.tsx (dashboard entry point)

Before the onboarding check, add a recovery step: if a user has no `org_id` on their profile and no `org_members` entry, auto-create an org using their `user_metadata.company_name` or `full_name`. This fixes existing broken users like ms@redigital.dk without manual intervention.

### 4. Add `account_type` column to `profiles` table

**Migration**: `ALTER TABLE profiles ADD COLUMN account_type text DEFAULT 'business'`

- Set during onboarding step 1 (already collected but not persisted to profiles)
- Save it alongside `onboarding_completed` in `handleComplete`
- For creators: the org is their personal workspace (UI hides "organisation" language)
- For business/agency: org is their company workspace

### 5. Allow account type switching in Settings

Add an "Account Type" selector to the Account settings section. Changing from creator → agency (or vice versa) just updates `profiles.account_type`. No structural changes needed since everyone has an org regardless.

### 6. Update `useOrg` hook with recovery

If `org_members` query returns no rows, attempt to create an org for the user (recovery path). This catches any edge cases where the trigger didn't fire (e.g., users created before this change).

### 7. Fix the "Founder" plan for ms@redigital.dk

The admin panel already supports subscription overrides. The Founder plan should be created as a hidden `subscription_plans` row (slug: `founder`, `is_active: false` so it doesn't show in pricing), or simply use the existing override mechanism (`override_max_clients: -1, override_max_connections: -1`). The admin can assign it via the org detail page.

## Files to Modify

| File | Change |
|---|---|
| Migration (SQL) | Update `handle_new_user()` trigger to create org + membership + starter plan. Add `account_type` to profiles. |
| `src/pages/LandingPage.tsx` | Remove org/membership/subscription creation from OTP handler. Just navigate to onboarding. |
| `src/pages/Index.tsx` | Add org recovery check before onboarding check. |
| `src/hooks/useOrg.ts` | Add recovery: if no membership found, create org for user. |
| `src/pages/OnboardingPage.tsx` | Save `accountType` to `profiles.account_type` in `handleComplete`. |
| `src/components/settings/AccountSection.tsx` | Add account type selector (Creator/Business/Agency). |

## Technical Flow After Changes

```text
Signup → auth.users INSERT → handle_new_user trigger:
  1. Create profile
  2. Create org (from company_name or full_name)
  3. Create org_members (owner)
  4. Set profile.org_id
  5. Assign Starter plan
  
OTP Verify → navigate to /onboarding (no DB writes needed)

Dashboard → recovery check → onboarding check → render
```

## What This Fixes
- ms@redigital.dk and any other users with missing orgs get auto-recovered
- New signups can never end up without an org
- Creators don't need to think about "organisations" — they just have a personal workspace
- Account type is switchable without data migration
- Plans remain on orgs (which is correct for multi-user agencies) but feel user-level since each user owns one org

