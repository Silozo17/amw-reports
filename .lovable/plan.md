

## Plan: Fix Video Views Hero KPI and Update Tooltips

### Problem
The "Video Views" hero KPI currently sums `video_views` from **all** platforms, including Meta Ads (paid). This inflates the number with paid video plays. The user wants it to only show organic video views.

Additionally, the info tooltips need updating:
- **Video Views**: should clarify "Organic video views"
- **Reach**: should clarify "Organic + paid reach"

### Changes

**1. `src/lib/dashboardCalcs.ts`** — Exclude `meta_ads` from Video Views aggregation

- Line 31: Filter out `meta_ads` when summing `video_views`
- Line 42: Same exclusion for previous period comparison
- Line 57: Same exclusion for platform icon detection
- Line 115 (sparklines): Exclude `meta_ads` from `video_views` sparkline aggregation

**2. `src/types/metrics.ts`** — Update tooltip descriptions

- Line 37: Change `video_views` from `'Number of times your videos were watched'` → `'Total organic video views across your social platforms'`
- Line 19: Change `reach` from `'Number of unique people who saw your content (includes both organic and paid reach)'` → `'Unique people who saw your content — includes both organic and paid reach'`

### No other changes
No backend, database, or other frontend files affected. Meta Ads will still sync and store `video_views` — it just won't be included in the hero KPI aggregation.

