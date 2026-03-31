

# Fix: Google Ads CTR Double-Division Bug

## Problem

The Google Ads CTR is stored as a **decimal ratio** (e.g., `0.1012` for 10.12%) but the display formatter in `PlatformMetricsCard.tsx` treats it as if it's already a percentage, rendering `0.10%` instead of `10.12%`.

This affects all platforms that store CTR as a ratio — Google Ads, Meta Ads, TikTok Ads, and potentially others.

## Root Cause

- **Sync function** (`sync-google-ads/index.ts` line 261): `overallCtr = totalClicks / totalImpressions` → stores `0.1012`
- **Display** (`PlatformMetricsCard.tsx` line 42-43): `value.toFixed(2)%` → renders `0.10%`
- Missing: a `* 100` conversion either at storage or display time

## Fix Approach

**Multiply by 100 at the display layer** in `PlatformMetricsCard.tsx`, since the ratio format is the standard across all sync functions and changing storage would require re-syncing all existing data.

### File: `src/components/clients/PlatformMetricsCard.tsx`

In the `formatMetricValue` function (line 42-43), when the key is `ctr`, multiply by 100 before formatting — but only if the value is ≤ 1 (to handle any snapshots that may already be stored as percentages):

```typescript
if (key === 'ctr' || key === 'engagement_rate' || key === 'conversion_rate' || key === 'audience_growth_rate') {
  const displayVal = (key === 'ctr' && value <= 1) ? value * 100 : value;
  return `${displayVal.toFixed(2)}%`;
}
```

### Also check these files for the same issue:
- `src/components/clients/dashboard/HeroKPIs.tsx` — if CTR flows into hero KPIs
- `src/components/clients/widgets/WidgetRenderer.tsx` — if CTR is rendered in widgets
- `src/lib/dashboardCalcs.ts` — already correctly recalculates `(totalSearchClicks / totalSearchImpressions) * 100` for GSC CTR, so that one is fine

### No edge function or database changes needed
The stored ratio format is correct and standard. Only the display needs fixing.

