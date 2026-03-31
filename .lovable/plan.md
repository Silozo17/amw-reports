

# Fix: CTR Still Showing 0.1% — Wrong Formatter

## Problem

The previous fix was applied to `PlatformMetricsCard.tsx`, but the dashboard is actually rendering metrics via `PlatformSection.tsx`, which has its own `formatMetricValue` function. That function (line 114) does not multiply ratio values by 100.

## Root Cause

`src/components/clients/dashboard/PlatformSection.tsx` line 112-114:

```typescript
const formatMetricValue = (key: string, value: number, currSymbol: string): string => {
  if (PERCENT_METRICS.has(key)) return `${value.toFixed(1)}%`;  // ← No ratio conversion!
};
```

Google Ads stores CTR as `0.1012` (ratio). This renders as `0.1%` instead of `10.1%`.

## Fix

**File: `src/components/clients/dashboard/PlatformSection.tsx`** — line 114

Change:
```typescript
if (PERCENT_METRICS.has(key)) return `${value.toFixed(1)}%`;
```

To:
```typescript
if (PERCENT_METRICS.has(key)) {
  const displayVal = value <= 1 ? value * 100 : value;
  return `${displayVal.toFixed(1)}%`;
}
```

This applies to all metrics in `PERCENT_METRICS`: `ctr`, `engagement_rate`, `bounce_rate`, `search_ctr`, `conversion_rate`, `audience_growth_rate`, `ga_engagement_rate`.

The `<= 1` guard ensures any snapshots already stored as whole percentages (e.g. `10.12`) are not double-multiplied.

**Single line change, single file.**

