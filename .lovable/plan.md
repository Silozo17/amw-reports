

# Performance Trend: Independent Y-Axis Normalization

## Problem
The Performance Trend chart in `PerformanceOverview.tsx` uses a shared Y-axis. Metrics like impressions (thousands) dwarf clicks/engagement (tens), making smaller lines flat — same issue we fixed for the GSC chart.

## Solution
Apply the same min-max normalization pattern already used in `PlatformSection.tsx` for the GSC chart.

## Changes

### File: `src/components/clients/dashboard/PerformanceOverview.tsx`

1. **Normalize trend data** — Before rendering, compute min/max per trend key (`impressions`, `clicks`, `engagement`, `reach`), then create normalized data with `_norm_` prefixed keys (0–1 range) and `_orig_` prefixed keys (original values for tooltip)

2. **Switch from `AreaChart` to `LineChart`** — Use `Line` components plotting `_norm_` keys instead of `Area` components plotting raw keys. Cleaner look matching the GSC chart style.

3. **Hide Y-axis** — Set `<YAxis hide domain={[0, 1]} />` since each line has its own scale

4. **Custom tooltip** — Replace `<CustomTooltip />` with a dedicated `TrendTooltip` that reads `_orig_` values and formats them with `toLocaleString()` (comma-separated numbers)

5. **Legend formatter** — Strip the `_norm_` prefix from legend labels so they display clean metric names

No other files change.

