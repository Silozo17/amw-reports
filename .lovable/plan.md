

## Server-Side Sync Queue — Never Miss a Sync Again

### Problem
All sync orchestration (initial backfill after OAuth connection, manual re-sync, multi-platform queuing) runs client-side in the browser. If a user navigates away, closes the tab, or loses internet, the sync stops mid-way and months of data are lost until the weekly Sunday gap-detection catches it.

### Solution
Create a persistent server-side sync queue backed by a database table. The client simply inserts a job row; a new edge function processes jobs sequentially. The client polls the table for progress display — but the sync runs independently of the browser.

### Architecture

```text
┌─────────────┐     INSERT job row     ┌──────────────┐
│  Browser /   │ ───────────────────►  │  sync_jobs   │  (DB table)
│  OAuth CB    │                       │  table       │
└─────────────┘                        └──────┬───────┘
                                              │
       ┌──────────────────────────────────────┘
       ▼
┌──────────────────┐    invoke per-month     ┌─────────────────┐
│  process-sync-   │ ──────────────────────► │  sync-google-ads │
│  queue (edge fn) │                         │  sync-meta-ads   │
│  (sequential)    │                         │  etc.            │
└──────────────────┘                         └─────────────────┘
```

### Changes

#### 1. New DB table: `sync_jobs`

```sql
CREATE TYPE sync_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  client_id uuid NOT NULL,
  org_id uuid NOT NULL,
  platform platform_type NOT NULL,
  months integer NOT NULL DEFAULT 12,
  status sync_job_status NOT NULL DEFAULT 'pending',
  progress_completed integer NOT NULL DEFAULT 0,
  progress_total integer NOT NULL DEFAULT 0,
  current_month integer,
  current_year integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  priority integer NOT NULL DEFAULT 0
);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
-- RLS: org members can view/insert; service role processes
```

#### 2. New edge function: `process-sync-queue`

- Queries `sync_jobs` for the oldest `pending` job (ordered by `priority DESC, created_at ASC`)
- Sets it to `processing`, updates `progress_completed` / `current_month` / `current_year` as each month completes
- Calls the per-platform sync function sequentially with 1.5s delays (same as backfill-sync)
- On completion, sets status to `completed` or `failed`
- Then checks for next pending job and processes it (loop until queue empty)
- Uses row-level locking (`FOR UPDATE SKIP LOCKED`) to prevent double-processing
- Deduplicates: skips if an identical pending/processing job already exists for the same connection+platform

#### 3. Trigger processing automatically

- After inserting a job, the client calls `process-sync-queue` (fire-and-forget) to kick off processing
- The `oauth-callback` edge function also inserts a job + triggers processing directly (so even if the user never returns to the page, sync starts)
- The `scheduled-sync` function inserts jobs instead of invoking sync functions directly

#### 4. Client-side changes

**`src/pages/clients/ClientDetail.tsx`:**
- Replace `SyncQueue` class usage with a simple insert into `sync_jobs` table
- Poll `sync_jobs` table for progress (every 3s while jobs exist for this client)
- Remove `syncQueue` state and `SyncQueue` import

**`src/components/clients/SyncProgressBar.tsx`:**
- Read from polled `sync_jobs` data instead of in-memory `QueueState`
- Show all pending/processing jobs for the current client

**`src/lib/syncQueue.ts`:**
- Delete this file (no longer needed)

**`src/lib/triggerSync.ts`:**
- Keep `triggerSync` for single-month manual use
- Remove `triggerInitialSync` (replaced by server queue)

#### 5. OAuth callback auto-enqueue

**`supabase/functions/oauth-callback/index.ts`:**
- After successfully connecting a platform, insert a `sync_jobs` row with the correct months (query org subscription for plan)
- Fire-and-forget invoke `process-sync-queue`
- This ensures sync starts even if the user closes the browser during the OAuth redirect

#### 6. Admin sync integration

**`supabase/functions/admin-sync/index.ts`:**
- Insert jobs into `sync_jobs` instead of directly invoking sync functions
- Trigger `process-sync-queue`

### What this guarantees

- **Browser-independent**: Sync runs entirely server-side once a job row is inserted
- **Sequential processing**: Jobs are processed one at a time in FIFO order with priority support
- **No duplicates**: Dedup check prevents the same platform from being queued twice
- **Crash-resilient**: If the edge function times out, the job stays in `processing` status; a periodic check (via `scheduled-sync`) can reset stale processing jobs back to `pending`
- **Observable**: Progress is stored in the DB — any page load can show current sync status
- **10-platform support**: User connects 10 platforms one by one; each inserts a job; they process in order regardless of browser state

