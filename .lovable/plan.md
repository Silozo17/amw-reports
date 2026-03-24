

# Fix Plan: 10 Sections — Metric Toggles, Dashboard Data, Layout & More

## Section 1: Fix Metric Toggle Race Condition
**File:** `src/components/clients/MetricConfigPanel.tsx`
- Replace `toggleMetric` (lines 87-103): Instead of reading from stale React `configs` state, fetch the latest `enabled_metrics` directly from Supabase via a fresh `.select()` query before updating
- Add try-catch wrapping and success toast
- Apply same try-catch + success toast pattern to `togglePlatform` (lines 75-85)

## Section 2: Add Save/Discard Batch Editing to MetricConfigPanel
**File:** `src/components/clients/MetricConfigPanel.tsx`
- Add `localConfigs` state (draft copy of `configs`) and `localPlatformEnabled` map
- Toggle clicks update local state only — no DB writes on click
- Add `hasChanges` computed boolean comparing local vs saved
- Render "Save Changes" (primary) + "Discard" (outline) buttons when `hasChanges` is true
- Show amber "Unsaved changes" badge in header
- On Save: batch-update all changed configs to Supabase, toast success, `fetchData()`
- On Discard: reset local state to match `configs`
- This replaces per-click DB writes entirely (Section 1 fix becomes the Save handler pattern)

## Section 3: Connect Metric Config to Dashboard
**File:** `src/components/clients/ClientDashboard.tsx`
- Add `client_platform_config` query to `fetchSnapshots` Promise.all
- Store as `platformConfigs` Map: `platform → { isEnabled, enabledMetrics }`
- Filter out platforms where `is_enabled === false` from rendering
- Pass `enabledMetrics` array to each `PlatformMetricsCard`

**File:** `src/components/clients/PlatformMetricsCard.tsx`
- Add `enabledMetrics?: string[]` to props
- Add filter: `(enabledMetrics ? enabledMetrics.includes(key) : true)`
- When `metricEntries.length === 0`, show dashed-border card with message instead of returning null

## Section 4: Fix Smart-Default / "No Activity" Bug
**File:** `src/components/clients/ClientDashboard.tsx`
- Change line 146 condition from `currentSnapshots.length === 0` to check whether ALL metric values across all snapshots are zero (using `Object.values(metrics_data).some(v => v > 0)`)
- Reset `hasAutoDetected` when `clientId` changes via a separate `useEffect`

## Section 5: Add Missing Metric Labels
**File:** `src/types/database.ts`
- Add `cpm: 'CPM'` and `page_views: 'Page Views'` to `METRIC_LABELS`
- Add `'cpm'` to `AD_METRICS` set (already present — confirm)

## Section 6: Fix Quarterly CPC Averaging
**File:** `src/components/clients/ClientDashboard.tsx` (lines 119-131)
- After summing all metrics, recalculate derived rate metrics from totals:
  - `cpc = spend / clicks`
  - `cost_per_conversion = spend / conversions`
  - `ctr = (clicks / impressions) * 100`
  - `engagement_rate = (engagement / impressions) * 100`
- Only do this recalculation instead of the current average-by-month approach

## Section 7: Optimise Trend Chart Query
**File:** `src/components/clients/ClientDashboard.tsx`
- Calculate 6-months-ago date and add `.or()` filter to trend query for server-side limiting
- Change trend chart render condition from `trendChartData.length > 1` to `> 0`

## Section 8: Dashboard Layout Improvements
**File:** `src/components/clients/ClientDashboard.tsx`
- KPI grid: change to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- Make PlatformMetricsCards collapsible using Collapsible component (default expanded, chevron toggle)
- Add sync status dot (green/red/amber) in PlatformMetricsCard header — pass connection data from dashboard
- Add "Last synced X ago" line below DashboardHeader using most recent `last_sync_at`
- Move Audience & Demographics placeholder after AI Analysis
- Update PIE_COLORS to AMW brand: `['#b32fbf', '#539BDB', '#4ED68E', '#EE8733', '#241f21', '#8b5cf6']`

**File:** `src/components/clients/PlatformMetricsCard.tsx`
- Add `syncStatus?: string`, `lastError?: string` props
- Render status dot + error banner when sync failed

**File:** `src/components/clients/DashboardHeader.tsx`
- Remove "Weekly" and "Custom" period types (add TODO comments)

## Section 9: Surface Facebook Sync Errors
**File:** `supabase/functions/sync-facebook-page/index.ts`
- Lines 111-112: Change `console.warn` in the insights catch block to also update `platform_connections.last_error` with the error message and set status to `'partial'`
- Add token expiry check: if `token_expires_at` is past, set error "Token expired" and return early

## Section 10: Minor Fixes
**File:** `src/types/database.ts` — confirm default currency is GBP (already done)
**Files with token references** — add security comment about plain text tokens
**File:** `supabase/functions/generate-report/index.ts` — add `cpm` and `page_views` to report's METRIC_LABELS

---

## Technical Notes

- **No files rewritten from scratch** — all changes are targeted edits
- **MetricConfigPanel refactor** (Sections 1+2) is the largest change: ~80 lines of new logic replacing ~30 lines
- **Dashboard changes** (Sections 3,4,6,7,8) are additive — existing query structure preserved, new query added to Promise.all
- **PlatformMetricsCard** gets 3 new optional props: `enabledMetrics`, `syncStatus`, `lastError`
- Collapsible wrapping uses existing shadcn `Collapsible` component (already in project)

