

# Fix Missing Historical Sync Data

## Root Cause

The initial 12-month historical sync runs **client-side** in `triggerInitialSync()`. It fires sequentially month-by-month from the browser. If the user navigates away, closes the tab, or the connection is slow, remaining months silently never sync. The **scheduled sync** only covers the current month (+ previous month in the first 7 days), so it never backfills these gaps.

## Current Gap Summary

| Client | Platform | Missing Months |
|---|---|---|
| Escape Campers | facebook | 10 |
| Serenity Pods | instagram | 10 |
| US Town Pizza | google_search_console | 9 |
| JR Stone | instagram | 9 |
| Serenity Pods | facebook | 9 |
| Wheels VT | instagram | 9 |
| Black Steel Doors | meta_ads | 8 |
| Wheels VT | tiktok | 7 |
| Escape Campers | meta_ads | 6 |
| Black Steel Doors | google_ads | 6 |
| + several more with 1-3 gaps | | |

## Fix: Two-Part Solution

### Part 1 — New `backfill-sync` Edge Function

A server-side function that:
1. Accepts `connection_id` and `months` (default 12)
2. For each month in the range, checks if a snapshot already exists
3. Only syncs months that are missing
4. Runs server-side so it cannot be interrupted by browser navigation

This will be used both for the immediate backfill and as the mechanism called by the scheduled sync.

**File:** `supabase/functions/backfill-sync/index.ts`

### Part 2 — Enhance `scheduled-sync` with Gap Detection

Modify the scheduled sync to periodically check for missing snapshots within the last 12 months for each active connection and trigger backfill syncs for gaps. This runs once per week (e.g., on Sundays) regardless of plan tier, processing gaps in batches to avoid overload.

**File:** `supabase/functions/scheduled-sync/index.ts` — add a gap-detection phase that runs on a specific day

### Part 3 — Immediate Backfill (One-Time)

After deploying the `backfill-sync` function, invoke it for all connections with gaps to fix the current data. This is a one-time operational action.

## Technical Details

### `backfill-sync/index.ts`
```text
Input: { connection_id, months?: 12 }

1. Fetch connection + client org_id
2. Verify auth (org membership or service role)
3. For each month in [now, now-1, ..., now-(months-1)]:
   - Check if monthly_snapshot exists for this client+platform+month+year
   - If missing, invoke the platform's sync function server-side
   - Rate limit: sequential with 1s delay between calls
4. Return { synced: [...], skipped: [...], failed: [...] }
```

### `scheduled-sync/index.ts` Changes
- Add a weekly gap-detection phase (e.g., `dayOfWeek === 0` for Sunday)
- For each active connection, query `monthly_snapshots` for the last 12 months
- If any month is missing, invoke `backfill-sync` for that connection
- Process in batches of 2 connections at a time to avoid overwhelming APIs
- Cap at 50 backfill invocations per run to stay within execution limits

### No Frontend Changes Required
The existing admin sync dialog already handles manual triggers. The gap detection is fully server-side.

| File | Change |
|---|---|
| `supabase/functions/backfill-sync/index.ts` | New edge function for gap-aware syncing |
| `supabase/functions/scheduled-sync/index.ts` | Add weekly gap detection + backfill phase |

