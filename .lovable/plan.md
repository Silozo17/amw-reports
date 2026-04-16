

# Fix: Daily Syncs Skip All Work — Snapshots Never Updated

## Root Cause

The `process-sync-queue` function (lines 171-190) filters out months that already have snapshots unless `force_resync` is true. Daily scheduled syncs set `force_resync: false` and `target_months: [April 2026]`. Since April 2026 snapshots already exist from previous syncs, the filter removes all months, leaving `missingMonths = []`. The job completes instantly with `progress_total: 0` — no API calls are made, no data is updated.

**Evidence from today (April 16):**
- 49 jobs enqueued at 04:00 UTC (05:00 BST) — scheduler worked correctly
- All 49 completed within 8 seconds (04:00:07 → 04:00:15) — impossibly fast
- All have `progress_total: 0, progress_completed: 0`
- Zero `monthly_snapshots` rows updated today

The snapshot-existence filter is correct for **backfill** jobs (filling gaps in historical data), but wrong for **daily syncs** which need to re-fetch the current month to get updated metrics.

## Fix

**File: `supabase/functions/process-sync-queue/index.ts`** (lines 171-190)

Change the snapshot filter logic to only apply when the job is a backfill (priority 0) or has `months > 2`. For daily/weekly jobs targeting 1-2 months, always sync regardless of existing snapshots — the sync functions already handle upserting.

```typescript
// Filter out existing snapshots ONLY for backfill jobs (priority 0 or large month ranges)
// Daily/weekly jobs (1-2 target months) must always re-sync to get updated data
const isBackfillJob = job.priority === 0 || (!job.target_months && job.months > 2);
let missingMonths = monthsRange;

if (!job.force_resync && isBackfillJob) {
  // ... existing snapshot filter logic stays the same
}
```

This means:
- **Daily syncs** (target_months with 1-2 entries, priority 1): always sync — data gets upserted
- **Reconciliation day** (force_resync true, priority 5): always sync — already works
- **Backfill jobs** (priority 0, no target_months, months=12): skip existing months — correct behavior
- **Manual syncs** (from UI, have target_months): always sync — correct behavior

## Summary

| What | Before | After |
|------|--------|-------|
| Daily sync for current month | Skipped (snapshot exists) | Always re-synced |
| Backfill gap detection | Re-syncs everything | Still skips existing months |
| Today's 49 jobs | 0 API calls, 0 data | All platforms updated |

## Deployment

Redeploy `process-sync-queue` edge function after the code change.

