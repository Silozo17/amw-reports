

# Fix Instagram Reach/Impressions Not Displaying

## Root Cause (Confirmed)

The previous version of `sync-instagram` bundled `profile_views` with `reach` in a **single API call**. The Instagram API rejected the entire request with a 400 error because `profile_views` requires `metric_type=total_value`. This meant **reach was never fetched**, so both `reach` and `impressions` (which mirrors reach) were stored as `0` in snapshots.

Edge function logs confirm this — every sync attempt logged:
```
Sync error: API error (400): profile_views should be specified with parameter metric_type=total_value
```

## Current Code Status

The code fix from the previous message is **already correct**:
- Line 108: fetches only `reach` with `period=day` ✅
- Lines 136-146: fetches `profile_views` separately with `metric_type=total_value` ✅
- Lines 148-157: fetches `website_clicks` separately ✅

**No code changes needed.** The existing snapshots just contain stale zero-values from the failed syncs.

## Action Required

Re-trigger Instagram syncs for all connected clients to populate reach/impressions data. Also re-trigger YouTube syncs (parameter name fix was applied in the previous message but no syncs have run since — logs are empty).

This will be done by invoking the edge functions directly for the current and recent months.

## Steps

1. Query `platform_connections` for all active Instagram and YouTube connections
2. Invoke `sync-instagram` and `sync-youtube` for each connection for the last 3 months
3. Verify the sync completes successfully by checking logs

