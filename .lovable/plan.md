

# Dashboard Overhaul Plan

This is a large redesign. To keep it manageable and avoid breaking existing functionality, I recommend splitting into **3 phases** across multiple messages.

## Phase 1: Foundation — Widget System + Grid Layout + Quick Fixes (this implementation)

### 1. Fix Anton Letter Spacing
- **`src/index.css`**: Add `letter-spacing: 0.05em` to the `h1-h6` base rule and a `.font-display` / `.font-heading` utility

### 2. Fix Markdown Rendering in AI Analysis + Reports
- **`src/components/clients/ClientDashboard.tsx`** (lines 921-929): Replace the naive `split("\n")` paragraph renderer with a proper markdown parser that converts `**bold**`, `*italic*`, `###` headings, and bullet lists to HTML
- Install/use a lightweight markdown renderer (e.g., `react-markdown` or a simple regex-based parser)
- **`supabase/functions/generate-report/index.ts`** (line 231): Strip markdown (`**`, `*`, `#`) from AI text before writing to PDF since jsPDF doesn't render markdown — use a `stripMarkdown()` helper

### 3. Create Widget Type System
New file: **`src/types/widget.ts`**
- Define `WidgetType`: `'number' | 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'radar' | 'table'`
- Define `DashboardWidget` interface: `{ id, metricKey, label, description, type: WidgetType, visible, position: {x, y, w, h}, platformFilter? }`
- Define `DashboardLayout`: collection of widgets with grid positions

### 4. Create Widget Renderer Component
New file: **`src/components/clients/widgets/WidgetRenderer.tsx`**
- Single component that takes a `DashboardWidget` + data and renders the appropriate chart type
- Supports: number card (current KpiCard style), line chart, area chart, bar chart, pie/donut chart, radar/spider chart, table
- Each widget gets a header with title, description, and a type-switcher dropdown (small icon button)
- Uses existing Recharts components and brand color palette

### 5. Create Widget Panel (Sidebar)
New file: **`src/components/clients/widgets/WidgetPanel.tsx`**
- Slide-out panel triggered by "Edit Dashboard" button
- Lists all available metrics grouped by platform (Ad Performance, Social Engagement, Website Analytics, etc.)
- Toggle switches to show/hide each widget
- Drag handle or position controls

### 6. Create Grid Layout System
New file: **`src/components/clients/widgets/DashboardGrid.tsx`**
- Use `react-grid-layout` for drag-and-drop with snap-to-grid
- Edit mode toggle: when active, widgets become draggable/resizable with visible grid lines
- When not in edit mode, layout is locked
- Persist layout to `localStorage` (or a database table in future)

### 7. Refactor ClientDashboard
- **`src/components/clients/ClientDashboard.tsx`**: Major refactor
  - Replace hardcoded KPI cards + chart sections with widget-based rendering
  - Default widget set auto-generated from available data (same metrics as today, but each as a widget)
  - Each platform's metrics from PlatformMetricsCard become individual widgets
  - Keep all existing data fetching logic (it works correctly)
  - Add "Edit Dashboard" button to header area
  - Sections ("Key Performance Indicators", "Spend & Engagement", etc.) become widget group headers

### 8. Default Widget Configurations
- **KPI Section**: Spend, Reach, Clicks, Engagement, Followers, Sessions — as `number` type widgets (2x1 grid cells)
- **Charts Section**: Spend Distribution (pie), Engagement Breakdown (bar), Performance Trend (area), Impressions & Clicks (bar) — as 4x3 grid cells
- **Platform Details**: Each platform's metrics as expandable widget groups
- **Content Tables**: Posts, Search Queries, Top Pages, Top Videos — as `table` type widgets (full width)

### Files to create
1. `src/types/widget.ts` — widget type definitions
2. `src/components/clients/widgets/WidgetRenderer.tsx` — renders any chart type from widget config
3. `src/components/clients/widgets/WidgetPanel.tsx` — toggle widget visibility
4. `src/components/clients/widgets/DashboardGrid.tsx` — draggable grid layout
5. `src/components/clients/widgets/ChartTypeSelector.tsx` — dropdown to switch chart type per widget

### Files to modify
1. `src/index.css` — Anton letter spacing
2. `src/components/clients/ClientDashboard.tsx` — refactor to use widget system + fix markdown
3. `supabase/functions/generate-report/index.ts` — strip markdown from AI text in PDF

### Dependencies to add
- `react-grid-layout` — for draggable/resizable grid
- `react-markdown` — for rendering AI analysis markdown

---

## Phase 2 (follow-up): Polish + Persistence
- Save widget layout per client to database
- Add radar/spider chart for multi-metric comparison
- Widget duplication and custom naming
- Mobile-responsive grid breakpoints

## Phase 3 (follow-up): Advanced Visualizations
- Funnel charts for conversion flows
- Heatmap for time-of-day engagement
- Comparison overlay mode (select 2 metrics to compare)

---

### Technical Notes
- Grid uses 12-column layout, widgets snap to columns
- Widget positions stored as `{x, y, w, h}` where x/y are grid units
- Chart type switching re-renders the same data with a different Recharts component
- All existing data fetching, KPI aggregation, and platform filtering logic is preserved unchanged
- The widget system wraps the existing rendering — no data layer changes needed

