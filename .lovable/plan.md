

# Fix: Facebook impressions & clicks aliases — organic only

## Problem
The previous plan proposed adding `impressions: totalViewsAll` (organic + paid) to Facebook's metricsData. But Meta Ads already contributes paid impressions to the hero KPI separately, so including paid views from Facebook would double-count.

## Change

**File: `supabase/functions/sync-facebook-page/index.ts`** (~line 350-366)

Add two alias fields to `metricsData`, using **organic-only** values:

```typescript
impressions: totalViews,          // organic only (not totalViewsAll) — avoids double-counting with Meta Ads
clicks: allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),  // alias for post_clicks
```

These are aliases of existing fields (`views` and `post_clicks`) so the hero KPI and bar chart logic that checks `m.impressions` and `m.clicks` will now pick up Facebook — but only organic impressions, since Meta Ads already provides the paid portion.

**No frontend changes needed** — the existing `m.impressions` and `m.clicks` checks in `ClientDashboard.tsx` will automatically detect Facebook once these fields exist.

One file, two lines added.

