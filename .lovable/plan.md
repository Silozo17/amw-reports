

## Reorder sidebar nav

Move **Content Lab** above **Settings** in `src/components/layout/AppSidebar.tsx`.

### Current order
Dashboard → Clients → Settings → Content Lab (collapsible) → Platform Admin

### New order
Dashboard → Clients → **Content Lab (collapsible)** → Settings → Platform Admin

### Change
In `AppSidebar.tsx`, the nav currently renders `[...BASE_NAV_ITEMS, ...TAIL_NAV_ITEMS]` (which puts Settings before the Content Lab collapsible block). Split this so:

1. Render `BASE_NAV_ITEMS` (Dashboard, Clients) first.
2. Render the Content Lab collapsible block.
3. Then render `TAIL_NAV_ITEMS` (Settings).
4. Platform Admin collapsible stays last (admin-only).

One file edited. No other changes.

