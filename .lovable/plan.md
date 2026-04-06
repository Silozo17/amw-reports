

# Fix Pinterest Sync Errors

## Problem

The Pinterest sync function has two bugs:

1. **Wrong API parameter**: Line 153 passes `metric_types=ORGANIC`, but per the Pinterest API docs, `ORGANIC` is a value for the `content_type` parameter — not `metric_types`. Valid `metric_types` values are: `ENGAGEMENT`, `ENGAGEMENT_RATE`, `IMPRESSION`, `OUTBOUND_CLICK`, `OUTBOUND_CLICK_RATE`, `PIN_CLICK`, `PIN_CLICK_RATE`, `SAVE`, `SAVE_RATE`.

2. **Hardcoded App ID**: Line 14 still uses the hardcoded `"1556588"` instead of reading from the `PINTEREST_APP_ID` environment variable (the connect function was already fixed, but the sync function was missed).

## Fix

### File: `supabase/functions/sync-pinterest/index.ts`

**Change 1** — Line 14: Replace hardcoded App ID with env var:
```ts
// Before
const appId = "1556588";
// After
const appId = Deno.env.get("PINTEREST_APP_ID")!;
```

**Change 2** — Lines 150-154: Fix the analytics API call parameters:
```ts
// Before
analyticsUrl.searchParams.set("metric_types", "ORGANIC");
analyticsUrl.searchParams.set("columns", "IMPRESSION,SAVE,...");

// After — remove metric_types=ORGANIC, add content_type=ORGANIC instead
analyticsUrl.searchParams.set("content_type", "ORGANIC");
analyticsUrl.searchParams.set("metric_types", "ENGAGEMENT,IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE");
```

Remove the `columns` parameter (not a valid v5 param) and let `metric_types` specify which metrics to return.

### Deployment

Redeploy `sync-pinterest` edge function after the fix.

