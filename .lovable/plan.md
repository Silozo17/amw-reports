

## Sync Missing Data for AMW Media + Root Cause Analysis

### Root Cause: Why Meta Ads Only Has 2 Months

Meta Ads was connected on **April 14 at 09:18**. The initial sync is triggered **client-side** via the `SyncQueue` in `ClientDetail.tsx` — it runs sequentially month-by-month from the browser. If the user navigated away, closed the tab, or the page refreshed during the sync, the remaining months were lost. The sync queue has no server-side persistence or resume capability, so interrupted syncs simply stop.

The weekly gap-detection backfill (runs on Sundays via `scheduled-sync`) would eventually catch this, but it hasn't run yet since the connection was made today.

### Current Data Gaps

| Platform | Months Synced | Expected | Missing |
|----------|--------------|----------|---------|
| Meta Ads | 2 | 24 | 22 months (May 2024 — Feb 2026) |
| Instagram | 23 | 24 | Aug 2025 |
| All others | 24 | 24 | None |

### Action Plan

1. **Trigger backfill-sync for Meta Ads** — call the `backfill-sync` edge function with `connection_id = e3654506-a5b9-4420-a74d-392f10067589`, `months = 24`, `start_offset = 0`. This will skip the 2 existing months and sync the remaining 22.

2. **Trigger backfill-sync for Instagram** — call with `connection_id = 0f9a7c15-4835-427f-a42f-285397f299f5`, `months = 24`, `start_offset = 0`. This will skip the 23 existing months and sync Aug 2025 only.

3. **No code changes needed** — the backfill-sync function already handles gap detection (skips existing snapshots). This is an operational data fix.

### Why This Won't Self-Fix Soon

The weekly gap-detection in `scheduled-sync` only runs on Sundays. Meta Ads was connected today (Monday), so without manual intervention it would take almost a week.

### Suggested Future Improvement (Not in Scope)

To prevent this recurring, a server-side initial sync (calling `backfill-sync` from `oauth-callback` directly) would ensure 24-month history is fetched regardless of client-side navigation. This is a separate task.

