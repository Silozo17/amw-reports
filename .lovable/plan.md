
The sync is still showing because there are stale `sync_jobs` rows (status `pending` or `processing`) for client `c2b194b6-3b2c-4f5a-9f00-95e13ca28027`. The progress bar shows whenever any such row exists. The user wants a **clean restart**.

## Plan (3 SQL ops + 1 function ping, no code changes)

All run via the insert tool (data ops, not migrations). All scoped to this one client.

### Step 1 — Inspect (read-only) what's actually in the queue
```sql
SELECT id, platform, status, started_at, current_month, current_year,
       progress_completed, progress_total, error_message, created_at
FROM sync_jobs
WHERE client_id = 'c2b194b6-3b2c-4f5a-9f00-95e13ca28027'
  AND status IN ('pending','processing')
ORDER BY created_at;
```
This confirms what's stuck before we touch anything.

### Step 2 — Mark all stuck rows for this client as failed
```sql
UPDATE sync_jobs
SET status = 'failed',
    completed_at = now(),
    error_message = 'Manual clean restart by user'
WHERE client_id = 'c2b194b6-3b2c-4f5a-9f00-95e13ca28027'
  AND status IN ('pending','processing');
```
This immediately clears the "Sync in progress" bar (the realtime subscription on `sync_jobs` will refresh `useSyncJobs`).

### Step 3 — Enqueue a fresh sync for every fully-connected platform
Plan slug determines history depth (Agency=24, else 12). Reusing the same logic the UI uses, server-side:
```sql
INSERT INTO sync_jobs (connection_id, client_id, org_id, platform, months, priority)
SELECT pc.id,
       pc.client_id,
       c.org_id,
       pc.platform,
       CASE WHEN sp.slug = 'agency' THEN 24 ELSE 12 END,
       1
FROM platform_connections pc
JOIN clients c ON c.id = pc.client_id
LEFT JOIN org_subscriptions os ON os.org_id = c.org_id AND os.status = 'active'
LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
WHERE pc.client_id = 'c2b194b6-3b2c-4f5a-9f00-95e13ca28027'
  AND pc.is_connected = true
  AND pc.account_id IS NOT NULL;
```

### Step 4 — Kick the queue processor
Call `process-sync-queue` once via `supabase--curl_edge_functions` (POST). The function will claim the new pending jobs and start running them. Realtime will then update the progress bar with real progress.

### Step 5 — Verify
- Re-run the SELECT from Step 1 → expect rows with `status='processing'` and progressing `progress_completed`.
- Tail `process-sync-queue` logs to confirm it started.

## Out of scope
- No code changes. The recently-deployed parallel queue (20 jobs / batches of 5 / atomic claim with re-fetch) stays as-is.
- Not enabling a watchdog cron in this turn (separate decision the user previously deferred).

## Risk
- **Low.** Failing the existing rows is non-destructive (no snapshots are deleted; previously-synced months remain). The new jobs will skip already-synced months for backfill priority logic — but since these are priority 1 (treated as fresh sync, not backfill), they will re-sync the latest month plus walk the history. If you'd rather *only* requeue the previously-stuck Facebook job rather than all 13+ platforms, say so before approval and I'll narrow Step 3.
