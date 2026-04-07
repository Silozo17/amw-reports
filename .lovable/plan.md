

# Fix: Agency Plan Always Gets 24-Month Sync

## Problem

`syncMonths` on line 54 of `ClientDetail.tsx` reads `entitlements.plan?.slug` which is `null` while the subscription query is still loading. When OAuth redirects back and auto-triggers a sync, the entitlements haven't resolved yet, so `syncMonths` evaluates to `12`.

The same race condition exists in the `handlePickerComplete` handler and the `handleNewPlatforms` flow — they all capture `syncMonths` at call time, which may be before entitlements load.

## Fix

### File: `src/pages/clients/ClientDetail.tsx`

**Change**: Instead of using `syncMonths` directly (which is derived from potentially-unloaded entitlements), create a helper function that fetches the plan slug from the database on demand — the same pattern already used in `ClientPortalAuth.tsx`:

```ts
const getSyncMonths = useCallback(async (): Promise<number> => {
  // If entitlements already loaded, use them
  if (entitlements.plan?.slug === 'agency') return 24;
  
  // Fallback: query the subscription directly to avoid race
  const { data: sub } = await supabase
    .from('org_subscriptions')
    .select('subscription_plans(slug)')
    .eq('org_id', client?.org_id ?? '')
    .single();
  const slug = (sub?.subscription_plans as unknown as { slug: string } | null)?.slug;
  return slug === 'agency' ? 24 : 12;
}, [entitlements.plan, client?.org_id]);
```

Then update all three call sites (OAuth auto-sync ~line 92, picker complete, and new platforms) to `await getSyncMonths()` before calling `triggerInitialSync`.

### Call sites to update

1. **Line ~92** (OAuth callback auto-sync): `const months = await getSyncMonths();` then use `months` for both `total` in progress state and the `triggerInitialSync` call.
2. **Line ~278** (`handleNewPlatforms`): Same pattern.
3. **Line ~250** (`handlePickerComplete`): Same pattern.

This ensures the sync depth is always correct regardless of whether entitlements have loaded.

