

# Fix TikTok Ads Sync + 24-Month Agency Sync

## Issue 1: TikTok Ads API — Invalid Metric Fields

The error `Invalid metric fields: ['conversions']` (code 40002) occurs because the TikTok Ads Reporting API v1.3 uses **`conversion`** (singular), not `conversions`. Same applies to `conversion_rate` → `cost_per_result` and `cost_per_conversion` → `cost_per_result`.

### File: `supabase/functions/sync-tiktok-ads/index.ts`

**Change 1 — Lines 114-129**: Fix advertiser-level metrics array:
```ts
const metrics = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "conversion",        // was "conversions"
  "cost_per_conversion",
  "reach",
  "video_views_p25",
  "video_views_p50",
  "video_views_p75",
  "video_views_p100",
];
```
Remove `conversion_rate` (not a valid v1.3 metric at AUCTION_ADVERTISER level).

**Change 2 — Lines 165-180**: Update metricsData mapping to match corrected field names:
```ts
conversions: Number(row.conversion || 0),        // field is "conversion"
cost_per_conversion: Number(row.cost_per_conversion || 0),
```
Remove `conversion_rate` from the output (derive it from conversion/clicks if needed).

**Change 3 — Line 187**: Fix ad-level metrics array similarly — replace `"conversions"` with `"conversion"`.

Redeploy `sync-tiktok-ads`.

---

## Issue 2: Agency Plan Should Sync 24 Months

`ClientDetail.tsx` (line 54) already has:
```ts
const syncMonths = entitlements.plan?.slug === 'agency' ? 24 : 12;
```
This is correct for the main client page. However, **`ClientPortalAuth.tsx` (line 182)** calls `triggerInitialSync` with no months argument, defaulting to 12.

### File: `src/pages/ClientPortalAuth.tsx`

**Line 182**: Pass the correct months count based on plan. This requires importing `useEntitlements` and computing `syncMonths` the same way.

### File: `src/lib/triggerSync.ts`

No change needed — the default parameter of 12 is fine since callers should pass the correct value.

---

## Summary of Changes

| File | Change |
|---|---|
| `supabase/functions/sync-tiktok-ads/index.ts` | Fix `conversions` → `conversion`, remove invalid `conversion_rate` metric, update mapping |
| `src/pages/ClientPortalAuth.tsx` | Use plan-aware `syncMonths` instead of default 12 |

