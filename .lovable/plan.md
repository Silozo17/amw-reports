

# Sync Failure Analysis — Root Causes and Fix Plan

## What happened

You triggered a Meta Ads sync via the admin panel. The job was enqueued and processed, but **0 months were synced** because all 24 months of Meta Ads snapshots already exist in the database. The queue processor skips any month that already has a snapshot — there is no "re-sync" or "overwrite" capability.

## Root Causes Found

### 1. Admin-sync ignores time mode parameters (CRITICAL)
The `AdminSyncDialog` sends `mode`, `month`, `year`, `start_month`, `start_year`, `end_month`, `end_year` in the payload — but `admin-sync/index.ts` **only reads `connections` and `months`** (line 78). All time-mode parameters are silently discarded. Every admin sync becomes a "full 24 months" job regardless of what you select.

### 2. Queue processor always skips existing snapshots (CRITICAL)
`process-sync-queue/index.ts` lines 160-175 filter out any month that already has a snapshot. There is **no way to force a re-sync** of existing data. This is the direct cause of "0 synced, 0 failed out of 0".

### 3. Admin-sync uses `getClaims()` which may not exist (MODERATE)
Line 52 calls `anonClient.auth.getClaims()` — this method doesn't exist in standard Supabase JS v2. It should use `getUser()` instead (same fix applied to `migrate-encrypt-tokens` earlier). Currently it works by coincidence if the SDK version includes it, but could break on SDK updates.

## Fix Plan

### Step 1: Update `admin-sync/index.ts` — Parse time mode and pass to sync jobs

- Read `mode`, `month`, `year`, `start_month/year`, `end_month/year` from the request body
- For `single_month` mode: store `target_month` and `target_year` on each sync job
- For `date_range` mode: calculate the specific months list
- For `full` mode: keep current behaviour (months = 24)
- Replace `getClaims()` with `getUser()` for auth validation

### Step 2: Add `force_resync` and `target_months` to `sync_jobs` table

Run a migration to add:
- `force_resync boolean NOT NULL DEFAULT false` — when true, the queue processor won't skip existing snapshots
- `target_months jsonb` — optional array of `{month, year}` objects for specific month targeting (null = use the `months` count from current date)

### Step 3: Update `process-sync-queue/index.ts` — Support re-sync and targeted months

- When `force_resync` is true, skip the "existing snapshots" filter
- When `target_months` is provided, use those specific months instead of `getMonthsRange()`
- Admin-triggered syncs (priority >= 10) should always set `force_resync = true`

### Step 4: Update `AdminSyncDialog` payload handling

- For `single_month`: send `target_months: [{month, year}]` and `force_resync: true`
- For `date_range`: compute month list from start→end, send as `target_months`
- For `full`: send `months: 24` and `force_resync: true`
- Fix the response handling — admin-sync returns `jobs_enqueued`, not `summary.synced/failed`

### Step 5: Fix `getClaims()` in admin-sync

Replace with `getUser()` pattern matching the fix already applied to `migrate-encrypt-tokens`.

---

### Technical Details

**Files to modify:**
- `supabase/functions/admin-sync/index.ts` — parse time params, pass to jobs, fix auth
- `supabase/functions/process-sync-queue/index.ts` — support force_resync + target_months
- `src/components/admin/AdminSyncDialog.tsx` — fix response handling (lines 191-195)
- Database migration: add columns to `sync_jobs`

**Files to redeploy:**
- `admin-sync`
- `process-sync-queue`

