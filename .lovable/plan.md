

# Threads Integration Fix — Sync Pipeline Missing Entry

## Problem

Threads is successfully connected (OAuth complete, account selected), but no data appears on the dashboard because **the sync pipeline doesn't recognise `threads` as a valid platform**.

The sync job `04704350-6d22-4c04-a341-a67e0715291b` failed with:
> `Unsupported platform: threads`

## Root Cause

Three edge functions each have their own `SYNC_FUNCTION_MAP` that maps platform keys to sync function names. All three are **missing the `threads` entry**:

1. **`supabase/functions/process-sync-queue/index.ts`** (line 25) — processes queued sync jobs
2. **`supabase/functions/backfill-sync/index.ts`** (line 24) — fills historical data gaps
3. **`supabase/functions/scheduled-sync/index.ts`** (line 5) — cron-based recurring syncs

Additionally, the **dashboard platform filter dropdown** in `src/components/clients/DashboardHeader.tsx` (line 13) has a local `PLATFORM_CATEGORIES` that is missing `threads` from the 'Organic Social' list — so even once data syncs, the user can't filter by Threads.

## Plan

### Step 1 — Add `threads` to all three sync maps
Add `threads: "sync-threads"` to the `SYNC_FUNCTION_MAP` in:
- `supabase/functions/process-sync-queue/index.ts`
- `supabase/functions/backfill-sync/index.ts`
- `supabase/functions/scheduled-sync/index.ts`

### Step 2 — Add `threads` to DashboardHeader filter
In `src/components/clients/DashboardHeader.tsx` line 13, add `'threads'` to the Organic Social platforms array.

### Step 3 — Deploy updated edge functions
Redeploy `process-sync-queue`, `backfill-sync`, and `scheduled-sync`.

### Step 4 — Re-queue the failed sync job
Reset the failed sync job to `pending` so it gets picked up on the next queue run, or trigger a manual sync.

