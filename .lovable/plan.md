
User wants to add a race-condition guard to the bulk-claim step. PostgREST `.update().in().eq("status","pending")` is atomic per-row at the DB level — only rows still pending will be updated. Then re-fetch to confirm what we actually claimed.

## Updated plan for `supabase/functions/process-sync-queue/index.ts`

### Constants
- `MAX_JOBS_PER_INVOCATION = 20`
- `PARALLEL_BATCH_SIZE = 5`

### Flow
1. **Stale-job reset** (unchanged) — reset `processing` jobs older than 10 min back to `pending`.

2. **Fetch up to 20 pending jobs** (priority desc, created_at asc).

3. **Atomic bulk claim with status guard:**
   ```ts
   const claimTimestamp = new Date().toISOString();
   await supabase
     .from("sync_jobs")
     .update({ status: "processing", started_at: claimTimestamp })
     .in("id", jobIds)
     .eq("status", "pending");
   ```
   The `.eq("status","pending")` filter ensures another concurrent invocation that already grabbed a job (flipping it to `processing`) cannot have its row overwritten.

4. **Re-fetch confirmed claims:**
   ```ts
   const { data: claimedJobs } = await supabase
     .from("sync_jobs")
     .select("*")
     .in("id", jobIds)
     .eq("status", "processing")
     .gte("started_at", new Date(Date.now() - 5000).toISOString());
   ```
   Only these rows are ours. Discard any in the original fetch that weren't returned here (another invocation claimed them).

5. **Process in parallel batches of 5** via `Promise.allSettled(batch.map(j => processJob(j, supabase)))`.

6. **`processJob(job, supabase)`** — extracted helper containing the existing per-job logic (connection check, platform fn lookup, months range, missing-month filter, sequential per-month invoke loop with progress updates, final status write). Per-month delay (`DELAY_BETWEEN_MONTHS_MS`) preserved inside a single job.

7. **Self-continuation** — count remaining `pending` rows; fire-and-forget invoke `process-sync-queue` if any remain.

### Out of scope
- No changes to `useSyncJobs`, sync function logic, watchdog cron, or any other file.

### Risk
- **Low.** The `.eq("status","pending")` guard makes the claim safely idempotent across concurrent invocations. Re-fetch with 5s window confirms ownership. Worst case: an invocation claims 0 jobs and exits cleanly.

### Deploy
Redeploy `process-sync-queue` via `supabase--deploy_edge_functions`.
