

# Widget Improvements: Typography, New Chart Types, and Empty State Handling

## Issues Identified

1. **Widget titles too small and cramped** — Currently `text-xs` with no letter-spacing; bold text at that size runs together
2. **Descriptions get cut off** — Currently `line-clamp-1` with `text-[10px]`, truncating useful context
3. **Missing chart types** — No progress ring / radial gauge ("Apple Watch fitness circles") or standalone pie chart options for KPI/platform widgets
4. **Empty gaps** — Widgets with value `0` are excluded from generation (line 248 of `ClientDashboard.tsx`), leaving holes in the grid; they should still render with a "No data" state

## Changes

### 1. Fix widget title typography (`WidgetRenderer.tsx`)
- Change `CardTitle` from `text-xs` to `text-sm` and add `tracking-wide` for letter spacing
- Change description from `line-clamp-1 text-[10px]` to `line-clamp-2 text-[11px]` so it wraps to 2 lines instead of truncating

### 2. Add new widget types (`src/types/widget.ts`)
- Add `'progress'` and `'gauge'` to the `WidgetType` union
- Add them to `COMPATIBLE_TYPES.kpi` and `COMPATIBLE_TYPES.platform`

### 3. Add progress ring / radial gauge renderers (`WidgetRenderer.tsx`)
- **Progress ring** — SVG circle with animated stroke-dashoffset showing percentage (0-100%), like Apple Watch rings; color-coded by performance
- **Gauge** — Semi-circle arc with a needle indicator, useful for CTR, engagement rate, bounce rate
- Both will use the widget's `value` and optional `change` data, rendering the numeric value in the center

### 4. Update `ChartTypeSelector.tsx`
- Add icons for the new `progress` and `gauge` types (use `Circle` and `Gauge` from lucide)
- Add labels: "Progress Ring", "Gauge"

### 5. Show widgets with zero/missing data (`ClientDashboard.tsx`)
- Remove the `val === 0` skip condition on line 248 — generate the widget regardless
- Keep `val === 0` widgets in `buildWidgetDataMap` (they already have `value: 0`)

### 6. Handle empty state in `NumberWidget` (`WidgetRenderer.tsx`)
- When `data.value` is `0` or `undefined` and there's no sparkline data, show a subtle "No data to display" message instead of just "0"

## Files Modified

- `src/types/widget.ts` — add `progress` | `gauge` types
- `src/components/clients/widgets/WidgetRenderer.tsx` — title/description typography, new ProgressRing + Gauge components, empty state
- `src/components/clients/widgets/ChartTypeSelector.tsx` — new type icons/labels
- `src/components/clients/ClientDashboard.tsx` — remove `val === 0` skip on line 248

