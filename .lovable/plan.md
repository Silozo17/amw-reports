

# Compact vs Extended Dashboard View Mode

## Concept

Add a **Compact / Extended** toggle to the dashboard controls. This changes how platform-level metrics are displayed:

- **Compact**: Similar metrics across platforms are merged into single widgets. For example, instead of separate "Google Ads — Impressions", "Meta Ads — Impressions", "Facebook — Impressions" widgets, there is one "Impressions" widget that aggregates all platforms and includes a platform filter dropdown to drill down. Charts like Engagement Breakdown already work this way. The Posts table already has a platform filter.

- **Extended** (current behavior): Every platform gets its own separate metric widgets, showing the full breakout.

## What Changes

### 1. Add view mode toggle (`ClientDashboard.tsx`)

- Add `viewMode` state: `'compact' | 'extended'` (default: `'compact'`)
- Add a segmented toggle (two buttons or a Select) next to the existing sort dropdown
- Persist choice in localStorage per client

### 2. Compact mode widget generation (`ClientDashboard.tsx` — `generateDefaultWidgets`)

When `viewMode === 'compact'`:
- **Skip individual platform widgets** entirely (the `platform-{name}-{metric}` widgets)
- Instead, generate **one widget per unique metric key** across all platforms (e.g., one "Impressions" widget, one "Reach" widget)
- Each compact widget gets a new field `platformSources: PlatformType[]` listing which platforms contribute data
- KPI and chart widgets remain unchanged (they're already cross-platform)

When `viewMode === 'extended'`:
- Current behavior — individual platform widgets are generated as-is

### 3. Compact widget data with platform filter (`buildWidgetDataMap`)

For compact metric widgets:
- Aggregate the metric value across all platforms by default
- Store per-platform breakdown in a new `WidgetData` field: `platformBreakdown?: Record<string, number>`
- When user selects a specific platform in the widget's filter, show only that platform's value

### 4. Platform filter inside compact widgets (`WidgetRenderer.tsx`)

For widgets that have `platformSources` with 2+ platforms:
- Add a small platform filter dropdown (similar to the posts table filter) in the widget header
- Default: "All" (shows aggregated value)
- Options: each platform with its logo
- Filtering updates the displayed value/change without regenerating the widget

### 5. Types update (`src/types/widget.ts`)

- Add `platformSources?: string[]` to `DashboardWidget`
- Add `platformBreakdown?: Record<string, number>` and `platformBreakdownChange?: Record<string, number>` to `WidgetData`

## Files Modified

- `src/types/widget.ts` — new fields on `DashboardWidget` and `WidgetData`
- `src/components/clients/ClientDashboard.tsx` — view mode state, toggle UI, conditional widget generation, compact data map building
- `src/components/clients/widgets/WidgetRenderer.tsx` — platform filter dropdown inside compact widgets, read `platformBreakdown` when filtered

## How It Looks

```text
Controls bar:
[Last synced 2h ago]     [Compact|Extended]  [Sort ▾]  [Edit]  [Widgets]  [AI Analysis]

Compact mode:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Impressions│ │  Reach   │ │  Clicks  │ │  Spend   │
│ All ▾    │ │ All ▾    │ │ All ▾    │ │ All ▾    │
│ 45.2K    │ │ 32.1K    │ │ 2.3K     │ │ £1,250   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

Extended mode (current):
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│G.Ads Imp │ │Meta Imp  │ │FB Imp    │ │IG Imp    │
│ 12.1K    │ │ 15.3K    │ │ 10.2K    │ │ 7.6K     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

