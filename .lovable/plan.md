

# Facebook Organic Views in Reach KPI + GSC Trend Chart

## What changes

### 1. Reach KPI uses Facebook organic views (not reach)

Currently, the Reach hero KPI aggregation (line 323) uses `m.reach || m.impressions || ...` — for Facebook, this picks up `reach` (organic unique viewers). The user wants Facebook to contribute its `views` metric (organic page views) instead.

**File: `src/components/clients/ClientDashboard.tsx`**

Update three places where reach is aggregated:

- **Line 323 (`totalReach`)**: For Facebook platform, use `m.views` instead of falling through the `m.reach` chain
  ```ts
  const totalReach = filtered.reduce((sum, s) => {
    const m = s.metrics_data;
    if (s.platform === 'facebook') return sum + (m.views || 0);
    return sum + (m.reach || m.impressions || m.search_impressions || m.views || m.gbp_views || 0);
  }, 0);
  ```

- **Line 334 (`prevReach`)**: Same Facebook-specific logic for previous period

- **Line 350 (`reachPlatforms`)**: Update the `platformsFor` callback to match the same Facebook-specific logic so the Facebook icon appears correctly

- **Line 414 (sparkline `reach`)**: Update the sparkline aggregation loop to use `views` for Facebook snapshots instead of `reach`

### 2. GSC Search Performance Trend chart

**File: `src/components/clients/ClientDashboard.tsx`**

Build a new `gscTrendData` array from `trendData`:
- Filter to `google_search_console` snapshots only
- Aggregate `search_impressions`, `search_clicks`, `search_ctr`, `search_position` per month over last 6 months
- Pass as new prop to `PerformanceOverview`

**File: `src/components/clients/dashboard/PerformanceOverview.tsx`**

- Accept new `gscTrendData` prop (array of monthly GSC metrics)
- Add a new "Search Performance Trend" card with an AreaChart
- Four series: Search Impressions, Search Clicks, CTR (%), Avg. Position
- Use independent Y-axis normalization (same pattern as existing Performance Trend)
- Custom tooltip showing original values with proper formatting (CTR as `X.X%`, position as decimal)
- Show GSC platform logo in the card header

### Files to modify
1. `src/components/clients/ClientDashboard.tsx` — Facebook views fix + build GSC trend data
2. `src/components/clients/dashboard/PerformanceOverview.tsx` — add GSC trend chart card

