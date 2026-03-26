

# Dashboard Widget System Overhaul

## Problems Identified

1. **Titles truncated** — 3x3 grid units with platform logo + title + info icon + chart selector don't fit
2. **Content doesn't fill widget space** — CardContent has fixed padding, inner components don't stretch
3. **Compact mode shows summed totals** — confusing; users expect to see each platform's value separately inside one card
4. **Platform filter dropdown is cramped** — sits too close to the title, small text, awkward
5. **Missing platform logos** — compact widgets have no logo since they represent multiple platforms
6. **Extended mode is overwhelming** — dozens of identical-looking cards with truncated "FACEBOOK — ..." labels

## Design Approach: Section-Based Layout

Inspired by best-practice marketing dashboards (Improvado, Adsbot, Databox), replace the current flat grid of identically-sized cards with a **structured, section-based layout**:

```text
┌─────────────────────────────────────────────────┐
│  HERO KPIs (top row, always visible)            │
│  [Reach] [Clicks] [Engagement] [Spend] ...      │
│  Each: big number + change badge + sparkline     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  CHARTS (mid section)                           │
│  [Engagement Breakdown] [Impressions & Clicks]  │
│  [Spend Distribution]  [Performance Trend]      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  PLATFORM METRICS (compact: grouped card)       │
│                                                 │
│  ┌─ Impressions ──────────────────────────────┐ │
│  │ 🟣 Facebook    468    ↓ 88.3%              │ │
│  │ 📷 Instagram   1,200  ↑ 14.3%              │ │
│  │ 🔴 Google Ads  27,808 ↑ 93.8%              │ │
│  │ ─────────────────────────────              │ │
│  │ Total          29,476                       │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Clicks ───────────────────────────────────┐ │
│  │ 🟣 Facebook    62     ↓ 54.1%              │ │
│  │ 📷 Instagram   8      ↓ 14.3%              │ │
│  │ 🔴 Google Ads  376    ↑ 12.0%              │ │
│  │ ─────────────────────────────              │ │
│  │ Total          446                          │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  TABLES (full width)                            │
│  [Performance by Post] [Search Queries] etc.    │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

### Compact Mode: Per-Platform Breakdown Rows (not summed totals)
Instead of showing one aggregated number with a dropdown filter, each compact widget becomes a **mini-table card** showing every platform's value on its own row with its logo, value, and change badge. A "Total" row at the bottom. This is instantly scannable — no clicking needed.

### Extended Mode: Same as Current (individual cards per platform-metric)
Keep the existing behavior but fix sizing/truncation issues.

### Widget Sizing Fixes
- KPI widgets: increase to `w:3, h:4` (was 3x3) to prevent content clipping
- Platform compact widgets: `w:4, h:auto` based on number of platforms (min h:4)
- Ensure `CardContent` uses `flex-1` with `overflow-auto` so content fills available space

### Title Truncation Fix
- Remove `truncate` from CardTitle, use `line-clamp-2` instead for wrapping
- Reduce chart type selector icon size to save horizontal space

## Files to Modify

### 1. `src/types/widget.ts`
- Add `platformRows` field to `WidgetData` for compact breakdown data: `Array<{ platform: string; value: number; change?: number }>`

### 2. `src/components/clients/widgets/WidgetRenderer.tsx`
- **New `CompactMetricWidget` component**: Renders a list of platform rows (logo + name + value + change badge) with a total row. No dropdown needed — all data visible at once.
- **Fix NumberWidget**: Remove fixed `min-h`, ensure content stretches to fill card
- **Fix CardHeader**: Remove `truncate` from title, use `line-clamp-2`. Tighten padding.
- **Remove the platform filter `Select`** from compact widgets — replaced by inline rows

### 3. `src/components/clients/ClientDashboard.tsx`
- **Compact widget generation**: Set `w:4, h:` based on platform count (3 + num_platforms rows, min 4, max 8)
- **buildWidgetDataMap**: For compact widgets, populate `platformRows` array with `{ platform, value, change }` per platform instead of just summing
- **Fix KPI widget positions**: Use `w:3, h:4` for KPIs to give more vertical space

### 4. `src/components/clients/widgets/DashboardGrid.tsx`
- Increase `ROW_H` from 72 to 80 to give each grid row more breathing room

## Technical Details

### CompactMetricWidget structure
```tsx
const CompactMetricWidget = ({ data }: { data: WidgetData }) => {
  const rows = data.platformRows ?? [];
  if (!rows.length) return <EmptyState />;
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="space-y-1">
      {rows.map(row => (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={PLATFORM_LOGOS[row.platform]} className="h-4 w-4" />
            <span className="text-xs">{PLATFORM_LABELS[row.platform]}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tabular-nums">{formatValue(row.value)}</span>
            {row.change && <ChangeBadge change={row.change} />}
          </div>
        </div>
      ))}
      <Separator />
      <div className="flex justify-between font-bold text-sm">
        <span>Total</span>
        <span>{formatValue(total)}</span>
      </div>
    </div>
  );
};
```

### Widget sizing in compact mode
```
platformCount = platformSources.length
h = Math.max(4, Math.min(8, 2 + platformCount))  // 2 base + 1 per platform
w = 4  // slightly wider than before (was 3)
```

Arranged in 3 columns of w:4 across the 12-col grid.

