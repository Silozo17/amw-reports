

# Fix Plan — 4 Facebook Issues

## Issue 1: Facebook Reach widget should show organic-only

**Problem**: The Facebook `reach` metric currently stores `page_total_media_view_unique` which includes paid reach. When this gets aggregated into the hero Reach KPI, it inflates the number.

**Root cause**: `page_total_media_view_unique` is total unique viewers (organic + paid). There's no separate organic-only reach metric available in Meta API v25 — BUT we can use the same `is_from_ads` breakdown approach we already use for views.

**Fix — Edge function** (`supabase/functions/sync-facebook-page/index.ts`):
- After Batch 1a (organic views), add a similar breakdown call for `page_total_media_view_unique` with `breakdown=is_from_ads`
- Store both `reach` (organic only, from `is_from_ads="0"`) and `reach_total` (organic + paid) in `metricsData`
- This way the hero KPI's `m.reach` will pick up the organic-only number for Facebook

**Accumulator changes**:
- Add `let totalUniqueViewersOrganic = 0;` alongside existing `totalUniqueViewers`
- In the breakdown loop, separate organic (`is_from_ads="0"`) vs paid viewers
- Set `reach: totalUniqueViewersOrganic` and `reach_total: totalUniqueViewers` (fallback: if breakdown fails, use total)

## Issue 2: Facebook top posts missing views + include clicks in hero

**Problem**: Post views show "—" because `post_total_media_view_unique` is returning 0 or failing. From the DB query, posts have `views: 0`. The `post_clicks_by_type` object metric returns data (clicks: 2 visible in one post) but views don't.

**Root cause**: Looking at the stored data, `post_total_media_view_unique` returns 0 for all posts. This metric may have limited availability. We need to try the alternative `post_impressions_unique` which is the v25 equivalent for post reach/views.

**Fix A — Edge function post insights Call 1**:
- Try `post_impressions_unique` alongside `post_total_media_view_unique` as fallback
- Use whichever returns a non-zero value: `postViews = post_total_media_view_unique || post_impressions_unique || 0`

**Fix B — Hero KPI clicks should include Facebook post_clicks**:
In `ClientDashboard.tsx` line 323, the `totalClicks` calculation uses `m.clicks` but Facebook stores clicks as `post_clicks` (summed from posts). Add Facebook's `post_clicks` to the hero:
```
return sum + (m.clicks || 0) + (m.search_clicks || 0) + (m.gbp_website_clicks || 0) + (m.post_clicks || 0);
```
Also need to store `post_clicks` in the edge function metricsData (already done — it sums `allTopPosts` clicks).

Wait — checking the current metricsData output: there's no `post_clicks` field stored. Need to add it:
```typescript
post_clicks: allTopPosts.reduce((s, p) => s + (p.clicks || 0), 0),
```

## Issue 3: Facebook engagement chart should say "Last 6 Months"

**Problem**: Line 413 in PlatformSection.tsx shows dynamic label `Last ${trendData.length} Month(s)`. With only 2-3 months of data, it says "Last 2 Months".

**Fix**: Change to static "Last 6 Months" to match Instagram:
```tsx
{chartLabel} — Last 6 Months
```

## Issue 4: Facebook data only synced from 2026

**Problem**: DB shows Facebook data for this client only from Jan 2026. The user wants 12 months like other platforms.

**Root cause**: The `handlePickerComplete` function in `ClientDetail.tsx` already syncs 12 months for **newly connected** platforms. However, this client's Facebook was connected on 2026-03-26 and only 3 months got synced. This is likely because:
1. The Facebook Page Insights API limits historical data to ~93 days for most metrics
2. The initial auto-sync DID run for 12 months but the API returned empty data for older months

**The real limitation**: Meta's Page Insights API does NOT return data older than ~93 days for most metrics. This is a Meta API limitation, not a code bug. The `page_media_view`, `page_follows`, etc. only return recent data.

**However**, the `published_posts` endpoint CAN return older posts with their reaction/comment/share counts. So we can still capture engagement data for older months even if page-level insights are unavailable.

**Fix**: No code change needed for the sync range — it already tries 12 months. The older months will naturally have limited data due to API restrictions. The chart showing "Last 2 Months" is addressed in Issue 3.

If the user wants to force a re-sync to attempt pulling older data, they can use the existing "Sync Last 12 Months" bulk sync button.

---

## Files to change

| File | Changes |
|------|---------|
| `supabase/functions/sync-facebook-page/index.ts` | Add organic reach breakdown; add `post_impressions_unique` fallback for post views; add `post_clicks` to metricsData |
| `src/components/clients/ClientDashboard.tsx` | Add `m.post_clicks` to hero totalClicks calculation |
| `src/components/clients/dashboard/PlatformSection.tsx` | Change chart label to static "Last 6 Months" |

