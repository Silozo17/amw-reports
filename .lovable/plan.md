

# Fix Google Integrations — Plan

## Summary of Issues Found

| Platform | Status | Root Cause |
|---|---|---|
| Google Ads | Working | No active campaigns since Nov 2025 — zero data is correct |
| Google Analytics | Connected but empty | Sync has never been triggered — no snapshots exist |
| Google Search Console | Connected but empty | Sync has never been triggered — no snapshots exist |
| Google Business Profile | Failed to connect | `mybusinessaccountmanagement.googleapis.com` quota is 0 req/min — discovery failed during OAuth |

## What Needs to Happen

### A. Google Business Profile (requires YOUR action first)
1. In Google Cloud Console → APIs & Services → `Business Profile Performance API` → Quotas → **"Requests per minute"** → click the 3-dot menu → Edit → increase to at least **60**
2. Also check `My Business Account Management API` has the same quota increase
3. After quota is increased, delete the current GBP connection in the app and re-add it (re-do OAuth) — this will re-run discovery and find the business location

### B. Code Fix: Auto-sync on connection (prevents GA4/GSC issue from recurring)
The real bug is that GA4 and GSC were connected but **never synced**. The platform should automatically trigger a sync when a connection is established or when an account is selected.

#### Files to modify:

**`src/components/clients/AccountPickerDialog.tsx`** — After a user selects an account (or after auto-selection in oauth-callback), trigger the sync function for the current month and previous month automatically.

**`src/pages/clients/ClientDetail.tsx`** — After detecting `oauth_connected` or `oauth_pending_selection` query params and the account is set, invoke the sync edge function for the last 3 months to populate initial data.

#### New helper: `src/lib/triggerSync.ts`
```typescript
export async function triggerInitialSync(
  connectionId: string, 
  platform: PlatformType,
  months: number = 3
) {
  const now = new Date();
  const promises = [];
  for (let i = 0; i < months; i++) {
    const d = subMonths(now, i);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const fnName = SYNC_FUNCTION_MAP[platform];
    if (fnName) {
      promises.push(
        supabase.functions.invoke(fnName, {
          body: { connection_id: connectionId, month, year }
        })
      );
    }
  }
  return Promise.allSettled(promises);
}
```

**`src/components/clients/ConnectionDialog.tsx`** — After successful OAuth redirect back, call `triggerInitialSync` for the newly connected platform.

### C. One-time fix: Manually trigger syncs for existing GA4 and GSC connections
Since GA4 and GSC are already connected but have no data, I will add a "Sync Now" action or trigger syncs programmatically for the last 6 months for both connections:
- GA4 connection: `be098aa8-eb14-4304-9f91-047a2c6ea84c`
- GSC connection: `1e3e34bb-c138-4221-8c4d-60db5b0d15d3`

This can be done by invoking the edge functions directly from the client dashboard or via a manual sync button.

### D. Add sync trigger to the dashboard
Add a "Sync" button per platform section on the client dashboard so users can manually trigger a sync for any connected platform. This already partially exists but should work for all platforms.

## Implementation Order
1. Create `triggerSync.ts` helper
2. Wire auto-sync into `AccountPickerDialog` and connection flow
3. Add per-platform "Sync Now" button to dashboard
4. Manually trigger GA4 + GSC syncs for the AMW Media client

## Technical Details
- Sync function names map: `google_analytics` → `sync-google-analytics`, `google_search_console` → `sync-google-search-console`, etc.
- The existing `CONNECT_FUNCTION_MAP` in `ConnectionDialog.tsx` maps platforms to connect functions; a similar `SYNC_FUNCTION_MAP` is needed
- Token refresh is handled inside each sync function, so calling them with expired tokens is fine

