

# Plan: Fix Currency, Data Accuracy, and Platform Metric Separation

## Root Cause Analysis (from database inspection)

**Actual data in monthly_snapshots for AMW Media:**

| Platform | Months with real data | Issue |
|----------|-----------------------|-------|
| Meta Ads | Oct-Jan (spend $147-$650, clicks, impressions) | Working correctly |
| Google Ads | Oct 2025 only ($112 spend, 35 clicks) | All other months show zeros — likely no ad spend those months |
| Instagram | Every month: `total_followers: 13303`, all other metrics zero | BUG: follower count is always current snapshot, not historical |
| Facebook | Every month: all zeros except `pages_count: 25` | API likely returning no data for page insights — possibly permissions issue |

**Issues identified:**

1. **PDF report uses hardcoded `$` symbol** (line 186, 241 in generate-report). Client currency is GBP but report shows `$`.
2. **Instagram `total_followers` is always 13,303** for every synced month because `sync-instagram` fetches the CURRENT follower count (`/ig_id?fields=followers_count`) and stores it as if it were the historical value. This is misleading — it should only be stored for the most recent sync, not backdated.
3. **Instagram shows zero engagement/reach/impressions** — the Instagram Insights API (`/ig_id/insights?metric=impressions,reach,profile_views`) may require the `instagram_manage_insights` scope, or the data genuinely doesn't exist for those periods (IG Insights only keeps 30 days of daily data).
4. **Facebook shows zero data** — same issue: `page_impressions`, `page_post_engagements` insights may have expired (Graph API keeps ~2 years but daily breakdowns are limited to 90 days).
5. **PlatformMetricsCard shows ALL metrics** from the snapshot including internal ones like `pages_count`, `campaign_count`, `roas: 0` — these clutter the display and confuse users.
6. **Dashboard KPI "Followers" shows 13.3K** because it sums `total_followers` across all platforms — but this is just the current Instagram count duplicated across months.

---

## Changes

### 1. Fix Currency in PDF Report

**File:** `supabase/functions/generate-report/index.ts`

- Read `client.preferred_currency` and look up the symbol (GBP→£, EUR→€, USD→$, PLN→zł, etc.)
- Replace all hardcoded `$` in `formatMetricValue` (line 186) and KPI cards (line 241) with the client's currency symbol

### 2. Fix Instagram Follower Count Problem

**File:** `supabase/functions/sync-instagram/index.ts`

- Only store `total_followers` when syncing the CURRENT month (i.e., when month/year matches now or previous month)
- For historical months, set `total_followers: 0` or omit it entirely — we cannot know what the count was months ago
- This prevents the misleading "13.3K followers" showing for every historical month

### 3. Filter Out Irrelevant/Internal Metrics from Display

**File:** `src/components/clients/PlatformMetricsCard.tsx`

- Create a `HIDDEN_METRICS` set: `['campaign_count', 'pages_count', 'roas']` — these are internal/derived values that shouldn't show as metric cards
- Filter them out before rendering
- Also hide metrics that are zero AND are not relevant to the platform type (e.g., never show `spend`, `cpc`, `cpm`, `cost_per_conversion`, `conversions`, `conversions_value` for Instagram or Facebook organic)

**File:** `src/types/database.ts`

- Add a `PLATFORM_ORGANIC_ONLY` set: `['facebook', 'instagram', 'linkedin']` — platforms where ad spend metrics should be hidden
- Add an `AD_METRICS` set: `['spend', 'cpc', 'cpm', 'cost_per_conversion', 'conversions', 'conversions_value', 'roas', 'campaign_count']`

### 4. Fix Dashboard KPI Follower Count

**File:** `src/components/clients/ClientDashboard.tsx`

- For the "Followers" KPI, only use the value from the LATEST month's snapshot, not sum across all platforms/months
- Show followers only if the value comes from the current selected period, not from a stale historical snapshot

### 5. Hide Zero-Only Platform Cards

**File:** `src/components/clients/ClientDashboard.tsx`

- When a platform has ALL displayable metrics as zero (after filtering out hidden/irrelevant metrics), show a compact "No activity" placeholder instead of a full card of zeros
- This prevents showing a full Instagram card with all zeros except "13.3K Followers"

### 6. Apply Currency Symbol to PDF KPI Cards

**File:** `supabase/functions/generate-report/index.ts`

- Pass currency symbol into the KPI card rendering and metric card rendering
- Ensure MoM comparison text also uses correct symbol

---

## Files Modified

- `supabase/functions/generate-report/index.ts` — use client currency symbol instead of `$`
- `supabase/functions/sync-instagram/index.ts` — only store followers for current/recent months
- `src/components/clients/PlatformMetricsCard.tsx` — filter hidden/irrelevant metrics per platform
- `src/components/clients/ClientDashboard.tsx` — fix follower KPI, hide zero-only platforms
- `src/types/database.ts` — add platform-specific metric visibility constants

## Execution Order

1. Add metric visibility constants to types
2. Fix PlatformMetricsCard filtering
3. Fix dashboard KPI and zero-platform handling
4. Fix Instagram sync follower logic
5. Fix PDF report currency

