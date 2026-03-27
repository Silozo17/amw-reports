
# Fix: Search Performance Trend Showing for Unrelated Platforms

## Problem
The GSC (Google Search Console) "Search Performance Trend" card in the Performance Overview section always renders regardless of which platform is selected. Selecting "Facebook" or "Google Ads" still shows the GSC chart.

## Root Cause
In `ClientDashboard.tsx` line 698, `gscTrendData` is passed unconditionally to `PerformanceOverview` — it's never filtered by the current `selectedPlatform`.

## Fix
One line change in `src/components/clients/ClientDashboard.tsx`:

Pass `gscTrendData` only when the platform filter includes GSC:
```tsx
gscTrendData={
  (selectedPlatform === "all" || matchesPlatformFilter(selectedPlatform, "google_search_console"))
    ? gscTrendData as unknown as Array<Record<string, unknown>>
    : []
}
```

This follows the exact same pattern already used for `trendChartData` and `trendPlatforms` filtering.

## Files
| File | Change |
|---|---|
| `src/components/clients/ClientDashboard.tsx` | Conditionally pass `gscTrendData` based on platform filter |
