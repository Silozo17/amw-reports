

# Fixes: TikTok Completion Rate + Sync Progress Bar + Report Generation Stages

## 1. TikTok Completion Rate Fix

**Root cause**: Lines 102-103 in `sync-tiktok-ads/index.ts` hardcode `avg_time_watched: 0` and `completion_rate: 0` because the `/v2/video/list/` endpoint doesn't return these fields.

**Fix**: After fetching the video list, make a second API call to TikTok's `/v2/video/query/` endpoint for each video (batched in groups of 20) requesting the `avg_time_watched` field. Then calculate `completion_rate = (avg_time_watched / duration) * 100` for each video.

The TikTok Content API v2 supports querying video details with additional fields via POST to `https://open.tiktokapis.com/v2/video/query/` with `fields=id,duration,avg_time_watched`. This requires the `video.insights` scope which may or may not be granted — so we wrap in try/catch and fall back to 0 if unavailable.

**File**: `supabase/functions/sync-tiktok-ads/index.ts`
- Add `fetchVideoInsights(accessToken, videoIds)` function that calls `/v2/video/query/`
- After building `enrichedVideos`, batch-fetch insights and merge `avg_time_watched` + calculate `completion_rate`
- Graceful fallback if the scope isn't available

## 2. Sync Progress Bar

**Current state**: `triggerInitialSync` in `src/lib/triggerSync.ts` runs a sequential loop but returns results only at the end. The UI shows a toast "Syncing 12 months of historical data..." with no progress.

**Fix**: Add an `onProgress` callback parameter to `triggerInitialSync` and surface it in the UI.

### File: `src/lib/triggerSync.ts`
- Add `onProgress` callback: `(completed: number, total: number, platform: string, month: number, year: number) => void`
- Call it after each month completes

### File: `src/components/clients/SyncProgressBar.tsx` (new)
- A fixed-position or inline progress bar component
- Shows: platform label, current month being synced, percentage, estimated time remaining
- Format: `SYNC IN PROGRESS: 24% — Syncing: Facebook (Mar 2025) · ~3:36 remaining`
- Uses the `Progress` UI component with text overlay
- Auto-dismisses when all syncs complete

### File: `src/pages/clients/ClientDetail.tsx`
- Add sync progress state: `{ platform: string; completed: number; total: number; currentMonth: string }[]`
- Pass `onProgress` callback to `triggerInitialSync` in `handlePickerComplete`
- Render `<SyncProgressBar>` when sync is active
- Track start time to estimate remaining time

## 3. Report Generation — Proper Status Stages

**Current state**: The `generate-report` edge function creates/updates the report record only on success (line 2058-2077). If it fails, no report row exists with "failed" status. The frontend `generateReport()` in `reports.ts` is synchronous — it blocks the UI.

**Fix**: Create the report record immediately with `status: 'pending'`, update to `running` when generation starts, then `success` or `failed` on completion.

### File: `supabase/functions/generate-report/index.ts`
- At the start (before any PDF work), upsert a report record with `status: 'running'`
- On success, update to `status: 'success'` with PDF path
- On error (catch block), update to `status: 'failed'` with error info
- This means the report row always exists and reflects real-time status

### File: `src/lib/reports.ts`
- `generateReport`: Before calling the edge function, insert a report record with `status: 'pending'` and return the report ID immediately
- The edge function updates it to `running` → `success`/`failed`
- This lets the UI show the "Generating" pill immediately

### File: `src/components/clients/ClientReportsTab.tsx`
- After calling `generateReport`, immediately add a "pending" entry to the local reports list
- Poll for status changes every 3 seconds while any report has `status: 'pending'` or `status: 'running'`
- Badge variants: `QUEUED` (pending) → `GENERATING` (running) → `SUCCESS` / `FAILED`

### File: `src/pages/Reports.tsx`
- Same polling logic for the main reports page
- Reports with running/pending status show animated indicator

### Status flow:
```text
User clicks Generate → report row created with status='pending'
Edge function starts → updates to status='running'  
Edge function completes → status='success' (with PDF) or status='failed'
Frontend polls every 3s → updates badge in real-time
```

### Concurrency safety:
- The edge function already handles upsert by checking for existing report with same client_id/month/year
- Add a check: if a report for that client/month/year already has `status: 'running'`, reject with "Report already being generated"
- This prevents duplicate generation when multiple users click simultaneously

---

## Files Summary

| File | Change |
|---|---|
| `supabase/functions/sync-tiktok-ads/index.ts` | Add video insights fetch for completion_rate |
| `src/lib/triggerSync.ts` | Add onProgress callback |
| `src/components/clients/SyncProgressBar.tsx` | New — progress bar component |
| `src/pages/clients/ClientDetail.tsx` | Wire up sync progress state |
| `supabase/functions/generate-report/index.ts` | Create report record early with running status, update on complete/fail |
| `src/lib/reports.ts` | Insert pending record before invoking edge function |
| `src/components/clients/ClientReportsTab.tsx` | Add polling for status updates, new badge variants |
| `src/pages/Reports.tsx` | Same polling logic |

