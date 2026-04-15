

# Fix: Sync Queue Drops Jobs After 10 — 4 Platforms Left Pending

## Root Cause

`process-sync-queue` has `MAX_JOBS_PER_INVOCATION = 10`. AMW Media has 14 connections. The queue processor ran once, completed 10 jobs, then exited. The remaining 4 (Instagram, Pinterest, TikTok Ads, LinkedIn Ads) are still `pending` with no mechanism to resume them.

The single fire-and-forget call from `useSyncJobs.enqueueSync` triggers `process-sync-queue` once. After it finishes 10 jobs and returns, nobody calls it again for the leftovers.

## Fix

Two changes to `supabase/functions/process-sync-queue/index.ts`:

1. **Self-continuation**: After the processing loop, check if there are still pending jobs in the queue. If so, fire-and-forget a new invocation of `process-sync-queue` before returning the response. This creates a chain that continues until the queue is drained.

2. **Increase batch size**: Raise `MAX_JOBS_PER_INVOCATION` from 10 to 25. Each single-month sync takes ~2-5 seconds, so 25 jobs fits well within the edge function timeout (~150s). This reduces the number of self-invocations needed.

### Code changes

**File: `supabase/functions/process-sync-queue/index.ts`**

- Line 35: Change `MAX_JOBS_PER_INVOCATION` from `10` to `25`
- After line 274 (end of while loop), before the return: Add a check for remaining pending jobs and self-invoke if any exist:

```typescript
// Self-continuation: if there are still pending jobs, trigger another run
const { data: remaining } = await supabase
  .from("sync_jobs")
  .select("id")
  .eq("status", "pending")
  .limit(1);

if (remaining && remaining.length > 0) {
  console.log("More pending jobs remain — triggering continuation...");
  fetch(`${supabaseUrl}/functions/v1/process-sync-queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  }).catch((err) => console.warn("Self-continuation failed:", err));
}
```

This ensures no jobs are ever orphaned regardless of queue size.

## Summary

| What | Before | After |
|------|--------|-------|
| Max jobs per run | 10 | 25 |
| Leftover handling | None — jobs orphaned | Self-continuation until queue empty |
| 14-connection client | 4 platforms skipped | All 14 guaranteed |

