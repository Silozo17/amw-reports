

# Performance Trend Labels, Number Formatting & GSC Hero KPIs

## Issues

1. **Performance Trend chart** has no indication of what platforms contribute to its data
2. **All charts** display raw numbers without thousand separators (e.g. `140000` instead of `140,000`)
3. **Hero KPIs** miss GSC-specific metrics: Search Impressions, Search Clicks, Search CTR, and Avg Position

## Changes

### File 1: `src/components/clients/dashboard/PerformanceOverview.tsx`

**Add platform source indicators to Performance Trend**
- Accept a new prop `trendPlatforms: PlatformType[]` listing which platforms contribute to the trend data
- Display small platform logos (same style as Hero KPI cards) next to the "Performance Trend" title
- Import `PLATFORM_LOGOS`, `PLATFORM_LABELS`, `PlatformType` and tooltip components

**Format all chart Y-axis ticks and tooltips with commas**
- Add a `tickFormatter` to every `<YAxis>` that uses `toLocaleString()` for comma-separated numbers
- Add a custom tooltip formatter to every `<RechartsTooltip>` that formats values with `toLocaleString()`
- Applies to: Spend Distribution tooltip, Engagement Breakdown Y-axis + tooltip, Impressions & Clicks Y-axis + tooltip, Performance Trend Y-axis + tooltip

### File 2: `src/components/clients/ClientDashboard.tsx`

**Add GSC metrics to Hero KPIs**
- Compute `totalSearchImpressions` from `search_impressions` across GSC snapshots
- Compute `totalSearchClicks` from `search_clicks`
- Compute `totalSearchCtr` from `search_ctr` (already stored as percentage)
- Compute `avgSearchPosition` from `search_position`
- Add corresponding previous-period values for change calculation
- Add 4 new KPI entries (only shown when value > 0):
  - **Search Impressions** — icon: `Eye`, metricKey: `search_impressions`
  - **Search Clicks** — icon: `MousePointerClick`, metricKey: `search_clicks`
  - **Search CTR** — icon: `Target`, metricKey: `search_ctr` (formatted as percentage with 1 decimal)
  - **Avg. Position** — icon: `BarChart3`, metricKey: `search_position` (formatted with 1 decimal)
- Add these metricKeys to sparklineMap computation
- For CTR and Position: mark them so `formatValue` in HeroKPIs shows them correctly (not abbreviated to K/M)

**Pass `trendPlatforms` to PerformanceOverview**
- Derive the list of platforms that have trend data from `trendData` filtered by `selectedPlatform`

### File 3: `src/components/clients/dashboard/HeroKPIs.tsx`

**Update `formatValue` to handle percentage and decimal metrics**
- Add `isPercentage` and `isDecimal` flags to `HeroKPI` interface
- When `isPercentage`, format as `X.X%` instead of abbreviating
- When `isDecimal`, format with 1 decimal place (for position)
- Add accent colors for new metric keys: `search_impressions`, `search_clicks`, `search_ctr`, `search_position`

**Format the animated counter value with commas**
- Update the existing `formatValue` to use `toLocaleString()` for all whole-number values (already does this for cost, but the K/M abbreviation path doesn't). For values under 1,000 it already calls `toLocaleString()`. The issue is values like 10,000 get abbreviated to "10.0K" — keep this abbreviation in hero cards since they're compact.

### File 4: `src/components/clients/dashboard/PlatformSection.tsx`

**Format Y-axis and tooltip values with commas**
- Add `tickFormatter={(v) => v.toLocaleString()}` to all `<YAxis>` components
- Add comma formatting to all custom tooltips

