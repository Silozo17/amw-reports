

# Fix: Allow Manual Client/Org Creation Without Google Business Profile

## Problem

Users believe they **must** have a Google Business Profile listing to add a client. The Google Places search button next to "Company Name" in `ClientForm.tsx` looks mandatory — there's no indication it's optional. If the search returns no results, users think they're stuck.

The signup and organisation creation flows have **no GBP dependency** — the issue is purely UX confusion on the client creation form.

## Changes

### File: `src/pages/clients/ClientForm.tsx`

1. Add helper text below the Company Name field: *"Type the name manually, or use the search icon to auto-fill from Google"*
2. Change the search button tooltip from "Search Google for business details" to "Optional: Auto-fill from Google"
3. When Google search returns 0 results, change the toast from `"No results found"` to `"No Google listing found — no problem, just fill in the details manually"`
4. When Google search fails (API error), change toast to `"Google lookup unavailable — enter details manually below"`

### File: `src/pages/OnboardingPage.tsx`

No changes needed — onboarding already works without GBP. The org setup step only requires a name.

## Summary

No structural changes. Four small copy/UX tweaks in `ClientForm.tsx` to make it obvious that Google Places search is a convenience feature, not a requirement.

