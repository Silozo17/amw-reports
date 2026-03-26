

# AMW Reports Platform — Total UX/UI Overhaul

## Current Problems Identified

### Client Dashboard (Critical)
1. **No visual hierarchy** — KPIs, charts, compact widgets, tables all look identical (same white cards, same styling). Nothing tells the eye where to look first.
2. **Widget overload** — dozens of same-sized cards with raw metric names like "impressions", "reach", "website_clicks". No grouping by platform or purpose.
3. **Compact mode confusion** — shows a flat list of platform rows with a "Total" but no context, no visual differentiation between platforms.
4. **Extended mode overwhelming** — individual platform widgets with truncated labels like "FACEBOOK — WEBSITE CLI..."
5. **Controls bar too busy** — Compact/Extended toggle, Sort dropdown, Edit Dashboard, Widgets panel, AI Analysis all crammed into one row.
6. **Empty sections at bottom** — "Audience Geography" and "Audience & Demographics" show "coming soon" placeholders, wasting space.
7. **Sparklines are tiny and meaningless** — small purple lines at the bottom of KPI cards with no labels.

### Global Home Dashboard (`/dashboard`)
8. **Status cards are hollow** — large cards showing "0" for most metrics, "5th" for next sync.
9. **Quick Actions redundant** — just duplicates sidebar navigation.
10. **Monthly Workflow is static** — hardcoded text, adds no dynamic value.

### Navigation & Layout
11. **Sidebar is minimal** — only 7 links, no hierarchy, no collapse.
12. **Client Detail page has too many tabs** — Dashboard, Overview, Connections, Recipients, Metrics, Settings — most users only care about Dashboard.
13. **Connections page (`/connections`)** is a flat list with no actionable insights.
14. **Logs page** is a raw list of cards with no filtering beyond tabs.
15. **Reports page** is a flat list with no calendar/grid view.

### Typography & Visual Identity
16. **Anton font for headings** is extremely bold and hard to read at small sizes — "WEBSITE CLICKS", "TOTAL SPEND" look aggressive.
17. **Beige/cream background** feels dated, not "premium".
18. **Cards have no depth variation** — everything is the same flat white card.

---

## Design Philosophy: "Clean Data Storytelling"

Inspired by AgencyAnalytics, Databox, Improvado, and Whatagraph:
- **F-pattern reading**: Critical KPIs top-left, supporting context mid-section, detail at bottom
- **Platform sections**: Group data by platform with clear visual headers (logo + label + status)
- **Progressive disclosure**: Summary first, detail on demand
- **Breathing room**: Generous whitespace, clear separation between sections
- **Consistent card hierarchy**: Hero cards (large), Section cards (medium), Detail cards (compact)

---

## Phase 1: Client Dashboard Overhaul (Biggest Impact)

### 1.1 Remove widget grid system entirely
Replace `DashboardGrid` (react-grid-layout style) with a **structured, scrollable layout** with clearly defined sections. No drag-and-drop needed for a reporting dashboard — this is a viewing experience, not a BI tool.

Remove these files/concepts:
- `DashboardGrid.tsx` — replaced by section-based layout
- `WidgetPanel.tsx` — no longer needed (all widgets are in fixed sections)
- `ChartTypeSelector.tsx` — remove from individual widgets
- Compact/Extended toggle — replaced by per-platform sections
- Sort mode selector — not needed with structured layout
- Edit mode — not needed without draggable grid

### 1.2 New dashboard structure

```text
┌─────────────────────────────────────────────────────────┐
│  HEADER: Platform filter + Period selector (simplified) │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  HERO KPIs (sticky/prominent)                           │
│  4 large cards in a row:                                │
│  [Total Reach] [Total Clicks] [Engagement] [Spend]      │
│  Each: big number + change badge + mini sparkline       │
│  Muted background, color-coded left border              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PERFORMANCE OVERVIEW (2-column chart section)          │
│  [Performance Trend — area chart, 6mo]                  │
│  [Engagement Breakdown — stacked bar by platform]       │
└─────────────────────────────────────────────────────────┘

FOR EACH CONNECTED PLATFORM:
┌─────────────────────────────────────────────────────────┐
│  ┌ PLATFORM SECTION HEADER ──────────────────────────┐  │
│  │ 🔵 Meta Ads          Connected · Synced 2h ago    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Impressions│ │  Clicks  │ │   CTR    │ │  Spend   │   │
│  │  27,808   │ │   376    │ │  1.35%   │ │  £91.16  │   │
│  │ ↑ 93.8%  │ │ ↑ 12.0% │ │ ↓ 2.1%  │ │ ↑ 5.2%  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  [Spend over time — line chart]   [Top content — mini   │
│                                    table if available]   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TABLES (full width, collapsible)                       │
│  Performance by Post | Search Queries | Top Pages       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  AI INSIGHTS (if generated) — card with summary         │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Platform Section Component (new)
Each connected platform gets its own visual section with:
- Platform logo + name + sync status in a colored header bar
- 3-5 key metrics as small stat cards in a grid
- One relevant chart (auto-selected: spend chart for ad platforms, engagement chart for social, traffic chart for analytics)
- Top content mini-table (if platform has posts/pages data)
- Platform-specific metric descriptions in plain English

### 1.4 Hero KPI Cards (redesigned)
- Much larger than current — full-width row of 4 cards
- Color-coded left border (purple for spend, blue for reach, green for engagement, orange for clicks)
- Large number with animated counter
- Change badge below (up/down arrow + percentage + colored)
- Sparkline in the background (subtle, decorative)
- Click to expand/drill down into platform breakdown

### 1.5 Simplified Controls
Remove: Compact/Extended toggle, Sort dropdown, Edit Dashboard button, Widgets panel
Keep: Platform filter, Period selector, AI Analysis button
Add: "Export PDF" shortcut button

---

## Phase 2: Global Dashboard & Navigation

### 2.1 Home Dashboard (`/dashboard`)
- Remove "Quick Actions" card (duplicates sidebar)
- Remove "Monthly Workflow" (static, not useful)
- Keep status cards but make them actionable (click navigates)
- Add "Recent Activity" feed (last 5 syncs/reports/emails)
- Add "Upcoming" section showing next scheduled sync

### 2.2 Sidebar
- Add platform connection status indicators next to "Connections"
- Add notification badge for failed syncs
- Consider collapsible sidebar for more content space

### 2.3 Client Detail Page
- Make "Dashboard" the only visible tab by default
- Move Overview, Connections, Recipients, Metrics, Settings into a settings/config drawer or sub-page accessible from a gear icon
- The dashboard IS the client page — tabs create unnecessary clicks

---

## Phase 3: Visual Identity Refresh

### 3.1 Typography
- Reduce Anton usage — only for page titles, not widget labels
- Use Montserrat Semi-Bold for section headers and card titles
- Smaller, cleaner metric labels

### 3.2 Color System
- Keep brand colors but add subtle gradients to section headers
- Use colored left borders on cards to indicate category (ads = purple, social = blue, analytics = green)
- Darker card backgrounds for hero sections

### 3.3 Spacing
- Increase gap between sections (from 16px to 32px)
- Add section dividers or subtle background color changes
- More padding inside cards

---

## Files to Modify

### New Files
- `src/components/clients/dashboard/HeroKPIs.tsx` — top KPI row
- `src/components/clients/dashboard/PlatformSection.tsx` — per-platform section
- `src/components/clients/dashboard/PerformanceOverview.tsx` — charts section
- `src/components/clients/dashboard/DataTables.tsx` — collapsible tables section

### Major Rewrites
- `src/components/clients/ClientDashboard.tsx` — remove widget grid, replace with section-based layout using the new components
- `src/components/clients/widgets/WidgetRenderer.tsx` — simplify dramatically, remove compact widget logic
- `src/pages/Index.tsx` — streamline home dashboard

### Removals (can be done later)
- `src/components/clients/widgets/DashboardGrid.tsx` — no longer needed
- `src/components/clients/widgets/WidgetPanel.tsx` — no longer needed
- `src/components/clients/widgets/ChartTypeSelector.tsx` — no longer needed

### Style Updates
- `src/index.css` — refined spacing, section backgrounds
- `tailwind.config.ts` — if needed for new utility classes

---

## Implementation Order

Due to the scope, this should be broken into 3-4 implementation messages:

1. **Message 1**: New client dashboard layout — HeroKPIs + PlatformSection components, rewrite ClientDashboard to use sections instead of widget grid
2. **Message 2**: Charts and tables integration — PerformanceOverview, DataTables, AI insights positioning
3. **Message 3**: Home dashboard cleanup + navigation improvements
4. **Message 4**: Visual polish — typography, colors, spacing refinements

This plan focuses on **Message 1** as the first implementation step, which delivers the highest-impact change.

