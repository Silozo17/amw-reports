

## Plan: Fix "Needs Attention" Showing Stale Failed Syncs Forever

### Problem
The dashboard queries **all** failed sync logs ever recorded (`sync_logs WHERE status = 'failed'`). Once a sync fails, the log entry persists forever, so the "Needs Attention" card never clears — even after the platform is reconnected and syncs successfully.

### Solution
Two changes to `src/pages/Index.tsx`:

**1. Only count recent failed syncs (last 7 days)**
Change the `syncsRes` query (line 97) to filter `started_at` to the last 7 days. Old failures that have since been resolved are no longer relevant.

```
.gte('started_at', new Date(Date.now() - 7 * 86400000).toISOString())
```

**2. Exclude failures that have a newer successful sync for the same platform+client**
After fetching, filter out any failed log where there's a more recent successful sync for the same `client_id + platform` combination. This way, if a user re-syncs and it succeeds, the failure disappears.

This requires fetching the `platform` column in `syncsRes` (already fetched in `recentSyncsRes` but not in the failed count query), then cross-referencing against successful syncs.

### Implementation detail

- Modify `syncsRes` query to also select `platform, started_at` and add the 7-day filter
- After fetching, for each failed log, check if a newer successful sync exists for the same `client_id + platform` pair (using data already available from `recentSyncsRes`, or adding a small additional query for recent successes)
- Also apply the same 7-day window to the "Failed Syncs" stat card count so it stays consistent

### Files changed

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Filter failed syncs to last 7 days + exclude superseded failures |

### No other changes needed
- No database changes — `sync_logs` table stays as-is
- No edge function changes

