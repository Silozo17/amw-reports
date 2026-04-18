
## Three changes

### 1. Hero KPI: sum followers across all platforms (currently shows max of one platform)
**File:** `src/lib/dashboardCalcs.ts` (line 30)

Currently:
```
const totalFollowers = Math.max(...filtered.map(s => s.metrics_data.total_followers || 0), 0);
```
This shows ONLY the largest single platform's count (e.g. if Instagram has 5K and LinkedIn has 3K, it shows 5K, not 8K).

**Fix:** For each connected platform, take the latest snapshot's follower count, then sum across platforms. (We can't simply sum every snapshot because each month re-reports the running total — that would double-count.)

Logic:
- Group snapshots by platform
- For each platform, pick the snapshot for the most recent month/year that has `total_followers > 0`
- Sum those latest-per-platform values → `totalFollowers`

### 2. Hero KPI: tooltip explainer
**File:** `src/components/clients/dashboard/HeroKPIs.tsx` — already renders `<MetricTooltip metricKey={kpi.metricKey} />` for every card.

**File to update:** `src/components/clients/MetricTooltip.tsx` — add/update the `total_followers` entry so its tooltip reads:
> "Combined total followers across all connected social accounts (Instagram, Facebook, LinkedIn, TikTok, YouTube, Threads, Pinterest)."

### 3. Per-platform follower display: always whole number with thousands separator
**File:** `src/components/clients/dashboard/platforms/shared/formatMetricValue.ts`

Currently 1,234 followers renders as "1.2K", 12,500 as "12.5K". User wants the raw count formatted as `1,234` / `12,500`.

**Fix:** Add `total_followers` (and `follower_growth`) to a new `WHOLE_NUMBER_METRICS` set that bypasses the K/M shortening and returns `Math.round(value).toLocaleString()`.

### 4. TikTok: add `total_followers` to sync
**File:** `supabase/functions/sync-tiktok-business/index.ts`

The `user.info.stats` scope is **already requested** in `tiktok-ads-connect/index.ts` (line 72), so no reconnect needed.

**Add:** Before building `metricsData`, call TikTok's `https://open.tiktokapis.com/v2/user/info/?fields=follower_count` with the same access token. Store the returned count as `total_followers` in `metricsData`. Wrap in try/catch — if it fails, log and continue without blocking the video sync (follows YouTube flexibility pattern).

## Out of scope
- No DB migrations, no UI structural changes, no other platforms touched.
- Existing per-platform follower data (Instagram/FB/LinkedIn/YouTube/Threads/Pinterest) is unchanged — only the rendering format shifts to whole numbers.

## Risks
- **Low.** Hero sum change could surprise users who memorised the old (max) number — but the new tooltip explains it. TikTok follower fetch is wrapped in try/catch so a TikTok API hiccup won't break the video sync.

## User action after deploy
1. Trigger a fresh TikTok resync for any client → confirm `total_followers` appears on TikTok platform card.
2. Open dashboard for a multi-social client → confirm Hero "Followers" card now shows the sum of all platforms (not the max), and hovering the (i) shows the explainer.
3. Confirm per-platform Followers tiles render as e.g. `12,500` not `12.5K`.
