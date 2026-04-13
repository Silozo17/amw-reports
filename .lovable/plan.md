

## Plan: Fix Facebook Reach to Show Organic Only

### Problem
The Facebook sync's reach parsing has a fallback (lines 317-322) that fires when the `is_from_ads` breakdown fails for `page_total_media_view_unique`. In this fallback, the total (paid + organic) value is assigned to **both** `totalUniqueViewers` and `totalUniqueViewersOrganic`, meaning `metrics_data.reach` ends up containing paid + organic reach instead of organic-only.

### Root Cause
The `page_total_media_view_unique` metric with `breakdown=is_from_ads` may not be supported by the Facebook API for all pages, or may return data in a format that doesn't match the parser. When this happens, the fallback assigns all reach to organic — inflating the number.

### Fix — `supabase/functions/sync-facebook-page/index.ts`

**Option A (matching the views pattern):** When the breakdown fails, do NOT assign the fallback value to `totalUniqueViewersOrganic`. Only assign it to `totalUniqueViewers` (total). Set `totalUniqueViewersOrganic` to 0 for that page so the `reach` metric stays organic-only.

Change lines 317-323 from:
```typescript
console.warn(`Reach breakdown failed for ${pageId}, falling back to total`);
const batch1b = await fetchPageInsights(...);
const totalReach = sumDailyValues(batch1b, "page_total_media_view_unique");
totalUniqueViewers += totalReach;
totalUniqueViewersOrganic += totalReach;  // BUG: assigns total to organic
```

To:
```typescript
console.warn(`Reach breakdown failed for ${pageId}, falling back to total`);
const batch1b = await fetchPageInsights(...);
const totalReach = sumDailyValues(batch1b, "page_total_media_view_unique");
totalUniqueViewers += totalReach;
// Do NOT add to organic — we can't distinguish paid vs organic without breakdown
```

This means when the breakdown fails, `reach` (organic) will be 0 rather than incorrectly inflated. `reach_total` will still have the total value.

### Files to Change
1. `supabase/functions/sync-facebook-page/index.ts` — remove the `totalUniqueViewersOrganic += totalReach` line in the fallback branch (line 322)

### No Frontend or Database Changes
The dashboard already reads `metrics_data.reach` which will now correctly contain organic-only values after re-sync.

