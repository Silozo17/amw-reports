

# Fix: Simplify Facebook Sync — Fetch Total, Subtract Paid, Store Organic

## Problem
The current sync batches newer organic-specific metrics (`page_impressions_organic_unique`, `page_video_views_organic`, etc.) into one API call. If ANY metric in that batch is unsupported by the page, the entire call fails silently, all accumulators stay at 0, and zeros get saved to the snapshot — wiping previously good data.

## Approach
Stop relying on organic-specific metrics. Instead, follow the simple formula:

**Fetch TOTAL metrics → Fetch PAID metrics → Organic = Total - Paid**

This uses only the stable, well-supported Facebook Page Insights metrics that have always worked.

## Changes

### File 1: `supabase/functions/sync-facebook-page/index.ts`

**Replace the single batch core metrics call (lines 161-197) with two separate, safer calls:**

**Call A — Totals (stable metrics that always work):**
- `page_post_engagements`
- `page_follows`
- `page_impressions` (total)
- `page_views_total`
- `page_consumptions`
- `page_video_views` (total)

**Call B — Paid breakdown (separate call, non-blocking):**
- `page_impressions_paid`
- `page_video_views_paid`

If Call B fails, paid = 0, so organic = total (safe fallback — no data loss).

**Remove:**
- `page_impressions_organic_unique` — not needed, we subtract instead
- `page_video_views_organic` — not needed, we subtract instead
- `page_media_view` and `is_from_ads` breakdown calls — unnecessary complexity
- All `totalMediaViews*` accumulators

**Final stored metrics:**
```
impressions: total_impressions - paid_impressions  (organic)
reach: total_impressions - paid_impressions         (same, organic impressions)
video_views: total_video_views - paid_video_views  (organic)
engagement: page_post_engagements (total, fine as-is)
page_views, link_clicks, follower_growth, total_followers — unchanged
likes, comments, shares, posts_published — from posts, unchanged
paid_impressions, paid_video_views — stored separately for boosted section
```

**Post-level:** Keep `post_impressions_organic_unique` and `post_impressions_paid_unique` per post since these are individual post endpoints (not batch) and work reliably. Keep `is_boosted` flag.

**Overwrite protection:** Before saving to `monthly_snapshots`, if impressions AND engagement AND total_followers are all 0 but posts exist with likes > 0, mark sync as `partial` and do NOT overwrite existing snapshot data.

### File 2: `src/types/database.ts`

- Remove `organic_impressions` from `METRIC_LABELS` and `PLATFORM_AVAILABLE_METRICS` for facebook — the main `impressions` key IS organic now, no need for a separate label
- Keep `paid_impressions`, `paid_reach`, `paid_video_views` in `HIDDEN_METRICS` so they only show in the boosted sub-section

### File 3: `src/components/clients/dashboard/PlatformSection.tsx`

- No structural changes needed — the Boosted/Paid sub-section already works off `paid_impressions > 0`
- Just ensure the Facebook `impressions` metric card label says "Impressions" (not "Organic Impressions") since it's already organic-only after subtraction

### Summary
- 1 edge function rewrite (simpler, fewer API calls, safer)
- Minor cleanup in types file
- No dashboard logic changes needed
- Data accuracy guaranteed: organic = total - paid, always

