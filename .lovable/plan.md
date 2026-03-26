

# GSC Chart: Independent Y-Axes + Decimal Rounding

## Problem
The GSC chart uses a single shared Y-axis. Impressions (thousands) dominate, making clicks (tens), CTR (decimals), and position (tens) appear as flat lines at the bottom — useless visually.

## Solution
Replicate Google Search Console's approach: each metric gets its own independent Y-axis so every line fills its vertical space based on its own data range. Hide all Y-axes to keep the chart clean (the KPI cards above already show exact values). The tooltip will show precise values on hover.

## Changes

### File: `src/components/clients/dashboard/PlatformSection.tsx`

**1. Normalize GSC trend data for independent scaling**

Before rendering the chart, transform each GSC metric into a 0–1 normalized value per-metric (min-max normalization). This makes each line fill the full chart height based on its own range.

Add a `normalizeGscData` helper:
- For each metric in `GSC_KEY_METRICS`, find its min and max across all data points
- Normalize each value to 0–1 range: `(value - min) / (max - min)`
- Store original values for tooltip display

**2. Replace the GSC `AreaChart` with `LineChart` using normalized data**

- Switch from `AreaChart` to `LineChart` (cleaner, matches GSC style)
- Use normalized values for Y-axis positioning
- Hide the Y-axis entirely (no tick labels needed — values differ per line)
- Custom tooltip formatter that displays the original (non-normalized) values with proper formatting (using `formatMetricValue`)

**3. Round GSC values to 1 decimal in tooltip**

Update the custom tooltip to format:
- `search_clicks` → whole number
- `search_impressions` → whole number or K format
- `search_ctr` → 1 decimal + `%`
- `search_position` → 1 decimal

This already works via the existing `formatMetricValue` function — just need to call it in the custom tooltip.

**4. Chart styling to match GSC**

- Use the existing `CHART_COLORS` array for distinct line colors
- `strokeWidth={2}`, `dot={{ r: 3 }}` — already in place
- Remove area fills (switch to `Line` from `Area`)
- Keep legend at bottom

### No other files need changes
The `formatMetricValue` function already handles `search_ctr` → `0.5%` and `search_position` → `47.2` with 1 decimal. The KPI cards are already correct.

