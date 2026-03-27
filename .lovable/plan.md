

## Plan: Replace "AMW" Loading Text with Org Logo (White-Label Only)

### What changes

There are **3 loading screens** that currently show hardcoded "AMW" text:

1. **`src/App.tsx` line 43** — `ProtectedRoute` loading state
2. **`src/App.tsx` line 64** — `AdminRoute` loading state
3. **`src/pages/Index.tsx` line 225** — onboarding check loading state

### Approach

Since all three locations are inside the `OrgProvider` tree, they can access `useOrg()` for the logo and `useEntitlements()` for the `hasWhitelabel` check.

**Logic for each loading screen:**
- If `org?.logo_url` exists **and** `hasWhitelabel` is true → show `<img src={org.logo_url}>` instead of the "AMW" text
- Otherwise → keep showing "AMW" as fallback (org data may not be loaded yet, or user is on a non-white-label plan)

### Files changed (2)

**`src/App.tsx`**
- Import `useOrg` and `useEntitlements`
- In `ProtectedRoute`: after the existing `useAuth()` call, add `useOrg()` and `useEntitlements()`. Update the loading return to conditionally render org logo or "AMW".
- In `AdminRoute`: same pattern — add org/entitlements hooks, update loading return.

**`src/pages/Index.tsx`**
- Already imports `useOrg`. Add `useEntitlements` import.
- Update the `!onboardingChecked` loading block to conditionally render org logo or "AMW".

### No other changes
- No database changes
- No edge function changes
- No new components

