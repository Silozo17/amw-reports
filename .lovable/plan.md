

## Plan: Add Sync Queue for Sequential Platform Syncing

### Problem
When a user connects multiple platforms in quick succession, each platform's 24-month sync fires concurrently. This causes:
- API rate limit failures (especially for Meta Ads)
- Incomplete syncs due to overlapping requests
- No visibility into which platform is waiting vs actively syncing

### Solution
Create a client-side sync queue that ensures only one platform syncs at a time. When a new connection triggers a sync while another is already running, it gets queued and starts automatically when the current one finishes.

### Changes

**1. New file: `src/lib/syncQueue.ts`**
- Create a `SyncQueue` singleton class that manages a FIFO queue of sync jobs
- Each job holds: `connectionId`, `platform`, `months`, `onProgress` callback
- `enqueue(job)` adds to queue; if nothing is running, starts immediately
- `processNext()` picks the next job, runs `triggerInitialSync`, then calls `processNext()` again
- Exposes observable state: `currentJob`, `queuedJobs`, `onStateChange` callback
- The queue is scoped per-page (not truly global) — created once in `ClientDetail`

**2. Update: `src/pages/clients/ClientDetail.tsx`**
- Replace the two direct `triggerInitialSync` calls (line ~106 and ~291) with `syncQueue.enqueue(...)`
- The queue ensures platform B waits for platform A to finish before starting
- Update `activeSyncs` state to show both the currently syncing platform and queued platforms (with a "queued" indicator)
- Progress bar continues to work as before — just one platform at a time

**3. Update: `src/components/clients/SyncProgressBar.tsx`**
- Add visual indicator for queued syncs (e.g. "Meta Ads — Queued" shown dimmed below the active sync bar)

### How it works
```text
User connects Google Ads  →  Queue: [Google Ads]  →  Syncing Google Ads (24 months)
User connects Meta Ads    →  Queue: [Meta Ads]    →  "Meta Ads — Queued" shown
Google Ads finishes        →  Queue: []            →  Syncing Meta Ads (24 months)
Meta Ads finishes          →  Queue: []            →  All done
```

### What stays the same
- `triggerInitialSync` and `triggerSync` functions unchanged
- `getSyncMonths` logic unchanged (already returns 24 for Agency)
- Admin sync dialog unchanged (it already runs sequentially)
- Edge functions unchanged

### Technical detail
The queue is a simple class with an array and a `processing` flag. No database table needed — this is purely client-side coordination to prevent concurrent API hammering. If the user navigates away, queued syncs are lost (same as current behavior where in-progress syncs are lost on navigation).

