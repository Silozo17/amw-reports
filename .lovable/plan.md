

# Fix Instagram Sync & YouTube Data Issues

## Issue 1: Instagram — `profile_views` metric error

**Root cause:** Line 108 of `sync-instagram/index.ts` requests `profile_views` with `period=day`, but the Instagram API now requires `metric_type=total_value` for `profile_views` (same as `website_clicks`).

The error from logs: `"(#100) The following metrics (profile_views) should be specified with parameter metric_type=total_value"`

**Fix:** In `supabase/functions/sync-instagram/index.ts`:
- Remove `profile_views` from the main insights call on line 108 (keep only `reach`)
- Add a separate fetch for `profile_views` using `metric_type=total_value` (same pattern as `website_clicks` on lines 138-146)

## Issue 2: YouTube — parameter name mismatch

**Root cause:** `sync-youtube/index.ts` expects `report_month` and `report_year` (line 15), but `triggerSync.ts` sends `month` and `year` (line 44). This means the YouTube sync function receives `undefined` for both parameters and returns a 400 error immediately.

**Fix:** In `supabase/functions/sync-youtube/index.ts`:
- Change the destructuring on line 15 from `{ connection_id, report_month, report_year }` to `{ connection_id, month, year }`, matching every other sync function
- Update all references to `report_month` → `month` and `report_year` → `year` throughout the function

## Files to modify

| File | Change |
|------|--------|
| `supabase/functions/sync-instagram/index.ts` | Move `profile_views` to its own `metric_type=total_value` fetch |
| `supabase/functions/sync-youtube/index.ts` | Rename `report_month`/`report_year` to `month`/`year` |

