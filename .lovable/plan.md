

# Dashboard Widget Enhancements: Platform Logos, Sort, Resize, Focus Fix

## 1. Add platform logo to every widget

**Problem**: Widget labels like "Impressions" appear for multiple platforms with no way to tell them apart.

**Solution**: Add a `platform` field to `DashboardWidget` type. When generating widgets in `ClientDashboard.tsx`, extract the platform from the widget ID (e.g., `platform-google_ads-impressions` → `google_ads`) and store it. In `WidgetRenderer.tsx`, render the platform logo (from `PLATFORM_LOGOS`) as a small 16x16 image next to the widget title.

### Files
- `src/types/widget.ts` — add optional `platform?: PlatformType` to `DashboardWidget`
- `src/components/clients/ClientDashboard.tsx` — set `platform` field on each widget during generation (KPI widgets get no platform, platform widgets get their platform, chart/table widgets get assigned based on context)
- `src/components/clients/widgets/WidgetRenderer.tsx` — render the platform logo in the card header next to the title

## 2. Add sort button to dashboard controls

**Problem**: No way to sort/group widgets by platform or other criteria.

**Solution**: Add a sort dropdown next to the Edit Dashboard button with options: "Default", "By Platform", "By Type", "By Name". Sorting reorders the `widgets` array before passing to `DashboardGrid`, recalculating positions based on sort order.

### Files
- `src/components/clients/ClientDashboard.tsx` — add `sortMode` state, a `Select` dropdown in the controls bar, and a `useMemo` that reorders widgets based on sort selection before passing to `DashboardGrid`

## 3. Enable widget resize via corner drag handle

**Problem**: Users cannot resize widgets.

**Solution**: Add a resize handle (bottom-right corner) visible in edit mode. When the user drags the handle, update `position.w` and `position.h` in grid units, respecting `minW`/`minH` constraints and a max of 12 columns wide / 8 rows tall.

### Files
- `src/types/widget.ts` — add `maxW?: number; maxH?: number` to `WidgetPosition`
- `src/components/clients/widgets/DashboardGrid.tsx` — add resize state (`ResizeInfo`), a resize handle element on each widget in edit mode, pointer handlers for resize (separate from drag), update widget dimensions on release and reflow layout
- `src/components/clients/ClientDashboard.tsx` — add `handleWidgetResize` callback to persist resized dimensions, pass it to `DashboardGrid`

## 4. Remove purple focus ring from buttons/selectors

**Problem**: The `--ring` CSS variable is set to the purple primary color (`295 60% 47%`), causing all focus rings to appear purple.

**Solution**: Change `--ring` to a neutral color that doesn't look like an active/selected state. Use the border color value instead.

### Files
- `src/index.css` — change `--ring` from `295 60% 47%` to `32 20% 82%` (light mode) and from `295 60% 47%` to `340 7% 20%` (dark mode), matching `--border` values

## Technical Details

### Platform extraction logic
Widget IDs follow patterns: `kpi-spend`, `chart-spend-distribution`, `platform-google_ads-impressions`, `table-gsc-queries`. Platform is extracted:
- `platform-{platform}-{metric}` → platform field set directly
- `kpi-*` → undefined (aggregated across platforms)
- `chart-*` → undefined (cross-platform charts)
- `table-gsc-*` → `google_search_console`, `table-ga-*` → `google_analytics`, `table-yt-*` → `youtube`

### Resize constraints
- Min: `minW` (default 2), `minH` (default 2)
- Max: `maxW` (default 12), `maxH` (default 8)
- Snap to grid units during resize
- Reflows other widgets via `compactLayout` after resize commit

### Sort modes
- **Default**: Original position order
- **By Platform**: Group widgets by platform, then alphabetical
- **By Type**: Group by category (KPI → Chart → Table → Platform)
- **By Name**: Alphabetical by label

