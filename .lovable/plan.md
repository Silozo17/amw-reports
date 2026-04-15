

# Fix Scheduled Sync Reliability & Add Data Reconciliation

## Root Cause Analysis

The scheduled-sync function has **51 active connections** to process. It invokes each sync function inline with a 60s timeout, in batches of 4. That means a full run needs ~13 batches × ~60s = **~13 minutes**, but Supabase Edge Functions have a **~150s wall-clock limit**. The function silently dies partway through, leaving connections like `tiktok_ads`, `linkedin_ads`, `pinterest`, `youtube`, `meta_ads`, `instagram`, `google_business_profile`, and `facebook` for AMW Media unsynced.

Today (April 15th), only 6 of AMW Media's ~14 connections synced at 5 AM. The rest still show April 14th timestamps.

## Plan

### 1. Refactor `scheduled-sync` to enqueue jobs instead of invoking directly

Instead of calling each sync function inline (which times out), the function will:
- Query eligible connections (same plan-gating logic)
- Insert rows into the `sync_jobs` table with `status: 'pending'`
- Call `process-sync-queue` once at the end

This way the queue processor handles syncs sequentially across multiple invocations, immune to the 150s limit. The scheduled-sync function becomes a lightweight "scheduler" that completes in seconds.

### 2. Add month-end reconciliation logic

**Problem:** Platforms like Meta, Google, and LinkedIn have 24–72 hour reporting delays. Data for the last days of a month may not be final until days into the next month.

**Solution:** Add a reconciliation window:
- On the **7th of each month** (or the first Monday on/after the 7th for weekly plans), enqueue a `force_resync` job for the **previous month** for every active connection
- This overwrites the snapshot with final, accurate data
- For weekly plans (Creator/Freelancer), the first sync on or after the 7th will also include the previous month

### 3. Extend "previous month overlap" to weekly plans

Currently, the "first 7 days also sync previous month" logic only fires for daily syncs. Weekly plans skip entirely on non-Mondays, so if a Monday falls on the 1st–7th, the previous month should also be synced. This is already partially there but the weekly plan gating runs before the month logic — needs reordering.

## Technical Changes

### File: `supabase/functions/scheduled-sync/index.ts`

Complete rewrite of the main loop:

```
// Instead of:
//   invokeWithTimeout(supabase, fnName, ...) per connection

// New approach:
//   1. Build list of eligible connections (same plan gating)
//   2. For each: INSERT INTO sync_jobs (connection_id, client_id, org_id, platform, months, target_months, priority, force_resync)
//   3. Deduplicate: skip if pending/processing job already exists for same connection+month
//   4. Trigger process-sync-queue once
//   5. Return summary of enqueued jobs
```

Key changes:
- Remove `invokeWithTimeout`, `BATCH_SIZE`, `SYNC_TIMEOUT_MS`
- Remove `notifySyncFailure` (process-sync-queue already handles failures)
- Add `force_resync: true` for reconciliation jobs on the 7th
- Extend previous-month logic to weekly plans when Monday falls in first 7 days
- Function completes in <5 seconds regardless of connection count

### No database changes needed

The `sync_jobs` table already has all required columns (`target_months`, `force_resync`, `priority`).

### No cron changes needed

The `0 4,5 * * *` schedule is correct — the UK-time guard handles DST.

## Summary

| What | Before | After |
|------|--------|-------|
| Sync execution | Inline, times out at ~24 connections | Queue-based, unlimited |
| AMW Media coverage | ~6/14 platforms synced | All 14 guaranteed |
| Month-end accuracy | Hope for the best | Forced re-sync on 7th |
| Weekly plan overlap | Previous month not synced | Previous month included on first eligible Monday |
| Function runtime | 150s+ (killed) | <5 seconds |

