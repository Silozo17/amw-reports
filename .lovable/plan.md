

# Client Portal: Platform Filters & Compact Scrollable Sections

## What Changes

### 1. Platform filter bar (when multiple platforms exist)
- Add a `selectedPlatform` state (`'all' | PlatformType`)
- Render a horizontal row of filter chips/badges above the platform sections, each showing the platform logo + label
- "All" chip selected by default; clicking a platform chip filters to only that platform's card
- Only show the filter bar when `snapshots.length > 1`

### 2. Compact platform cards with internal scroll
- Give each platform `CardContent` a fixed max-height (~280px) with `overflow-y-auto` using the existing `ScrollArea` component
- The metric grid inside each card scrolls internally instead of expanding the page
- Cards become uniform height, keeping the page compact

## Files Modified

- `src/pages/ClientPortal.tsx`
  - Add `useState` for `selectedPlatform`
  - Add filter chip row (using `Badge` components with platform logos)
  - Filter `snapshots` by selected platform before rendering
  - Wrap each platform card's metric grid in `ScrollArea` with `max-h-[280px]`
  - Import `ScrollArea` and `Badge`

No database or backend changes needed.

