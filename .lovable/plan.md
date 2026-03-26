

# Add Gradient Fills to Performance Trend & Search Performance Charts

## Problem
The Performance Trend (PerformanceOverview) and Search Performance (PlatformSection GSC) charts use plain `LineChart` with no gradient fill, while all other line graphs in the app use `AreaChart` with `linearGradient` fills beneath the lines.

## Solution
Convert both charts from `LineChart`+`Line` to `AreaChart`+`Area` with gradient `<defs>`, matching the existing pattern used in other platform charts.

### File 1: `src/components/clients/dashboard/PerformanceOverview.tsx` (lines 224-242)

- Switch `LineChart` → `AreaChart` and `Line` → `Area`
- Add `<defs>` block inside `AreaChart` generating a `linearGradient` per trend key (using each key's color, opacity 0.2→0)
- Each `Area` gets `fill={url(#grad-trend-${tk.key})}` plus the existing `stroke`, `strokeWidth`, `dot` props
- Keep the hidden YAxis, normalized data, TrendTooltip, and Legend formatter unchanged

### File 2: `src/components/clients/dashboard/PlatformSection.tsx` (lines 370-394)

- Switch `LineChart` → `AreaChart` and `Line` → `Area` for the GSC Search Performance chart
- Add `<defs>` block generating a `linearGradient` per active GSC metric (using `CHART_COLORS[i]`, opacity 0.2→0)
- Each `Area` gets `fill={url(#grad-gsc-${key})}` plus existing stroke/dot props
- Keep hidden YAxis, normalized data, GscTooltip, and Legend unchanged

Both charts retain the independent Y-axis normalization — only the visual rendering changes from bare lines to lines with gradient area fills.

