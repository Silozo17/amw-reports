

# Add "Posts Published" and "Stories" KPI Widgets to Dashboard

## Summary
Add a "Posts Published" hero KPI card that aggregates `posts_published` across all organic social platforms (Facebook, Instagram, LinkedIn, TikTok, Pinterest, YouTube) with month-over-month comparison. Stories data is **not currently synced** by any platform integration, so that cannot be added without new API work.

## What exists today
- `posts_published` is already synced and stored in `metrics_data` for Facebook, Instagram, LinkedIn, and TikTok organic.
- The metric has labels, explanations, and report support already.
- It is **not** included in the hero KPI cards in `computeKpis()` or sparklines in `computeSparklines()`.
- No platform currently syncs a `stories_count` or equivalent metric.

## Changes

### 1. `src/lib/dashboardCalcs.ts`
- **computeKpis**: Add `totalPostsPublished` aggregation (sum `posts_published` across filtered snapshots), with previous-month comparison. Add a new KPI entry with label "Posts Published", icon `FileText` (or `PenSquare`), metricKey `posts_published`. Only show for organic social platforms when filter is "all" or includes an organic platform.
- **computeSparklines**: Add `posts_published` to the monthly aggregation map and the sparkline output loop.

### 2. Icon import
Add `PenSquare` (or reuse `FileText`) from lucide-react in the imports.

### No other files need changes
The KPI rendering in `HeroKPIs.tsx` is already generic and renders whatever `computeKpis` returns.

## Stories — not possible yet
None of the sync functions (Instagram, Facebook, TikTok) currently fetch story data from their APIs. Adding stories would require changes to the sync edge functions and potentially new API scopes. I'll skip this for now — let me know if you'd like me to scope that out separately.

| File | Change |
|---|---|
| `src/lib/dashboardCalcs.ts` | Add posts_published KPI + sparkline aggregation |

