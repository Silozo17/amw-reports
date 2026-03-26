

# Facebook Organic vs Paid Data Accuracy Fix

## Answering Your Question First

**Yes, you must subtract to get organic data.** Here's exactly how Facebook metrics work:

- `page_impressions` = **total** (organic + paid + viral). Includes everything.
- `page_impressions_paid` = only impressions from ads (boosted posts OR actual ad campaigns).
- `page_posts_impressions_organic_unique` = organic-only reach (unique people, excludes paid).
- `page_media_view` with `breakdowns=is_from_ads` = splits media views into `true` (paid) and `false` (organic).

Facebook's own docs confirm: *"Total page reach may not always be exactly equal to the sum of paid and non-paid unique values"* and *"When an organic post is boosted, metrics for paid post impressions will include both organic and paid reach."*

So the approach is: **use the dedicated organic-only metrics where available** (e.g. `page_posts_impressions_organic_unique`, `page_video_views_organic`), and only fall back to subtraction (`total - paid`) when no native organic metric exists.

### Current Problems in `sync-facebook-page/index.ts`

1. **Impressions**: Uses `page_media_view` which includes paid. The `is_from_ads` breakdown is fetched but as a separate call that may fail silently, leaving `totalMediaViewsOrganic = 0` and falling back to total media views.
2. **Reach**: Set to `organicImpressions` (a copy of media views) — not actual reach at all. Facebook has `page_impressions_unique` for reach and `page_impressions_organic_unique` for organic-only reach, but neither is fetched.
3. **Post-level reach**: Uses `post_impressions_unique` which includes paid reach. Should use `post_impressions_organic_unique`.
4. **Video views**: Aggregated from `post_video_views` per post, which includes paid views. Facebook has `page_video_views_organic` for organic-only.
5. **Engagement**: Uses `page_post_engagements` which includes engagement from ads. No organic-only equivalent exists at page level, but this is acceptable since engagement is engagement regardless of source.
6. **Dashboard double-counting**: When both Facebook and Meta Ads are connected, the Hero KPI "Reach" sums Facebook's reach (which may include paid) with Meta Ads' reach.

## Plan

### File 1: `supabase/functions/sync-facebook-page/index.ts`

**Replace the metrics collection with Facebook's recommended organic-specific metrics:**

**Page-level metrics to fetch:**
- `page_impressions` (total) — for reference
- `page_impressions_paid` (paid only) — to subtract or store separately
- `page_impressions_organic_unique` (FB-recommended organic reach)
- `page_posts_impressions_organic_unique` (organic post reach)
- `page_video_views_organic` (organic video views only)
- `page_video_views_paid` (paid video views — stored separately)
- `page_video_views` (total video views — stored for reference)
- Keep existing: `page_post_engagements`, `page_follows`, `page_views_total`, `page_consumptions`
- Keep: `page_media_view` with `is_from_ads` breakdown as a secondary signal

**Post-level metrics to fetch:**
- Switch from `post_impressions_unique` → `post_impressions_organic_unique` for per-post reach
- Add `post_impressions_paid_unique` to store separately (useful for boosted post detection)
- Keep `post_video_views` for total, but tag posts that have paid impressions

**New `metrics_data` shape stored in snapshot:**
```
{
  // Organic-only (primary display metrics)
  impressions: <page_impressions - page_impressions_paid>,
  reach: <page_impressions_organic_unique summed daily>,
  video_views: <page_video_views_organic summed daily>,
  
  // Paid (stored for separate display / boosted post users)
  paid_impressions: <page_impressions_paid summed daily>,
  paid_reach: <page_impressions_paid_unique summed daily>,  
  paid_video_views: <page_video_views_paid summed daily>,
  
  // Totals (for reference / validation)
  total_impressions: <page_impressions summed daily>,
  total_video_views: <page_video_views summed daily>,
  
  // These are already fine as-is
  engagement, page_views, link_clicks, follower_growth, 
  total_followers, likes, comments, shares, posts_published,
  engagement_rate (recalculated from organic reach)
}
```

**Per-post `top_content` additions:**
- Add `organic_reach` (from `post_impressions_organic_unique`)
- Add `paid_reach` (from `post_impressions_paid_unique`)
- Keep `reach` as organic-only (rename source)
- Add `is_boosted: true/false` flag (true if `paid_reach > 0`)

### File 2: `src/components/clients/dashboard/PlatformSection.tsx`

**Add "Boosted Performance" sub-section for Facebook when paid metrics exist:**
- When `paid_impressions > 0` in Facebook snapshot, show a collapsible "Boosted / Paid Performance" card below the organic metrics
- Display: Paid Impressions, Paid Reach, Paid Video Views
- This gives visibility to users who boost posts but don't use Meta Ads separately
- In the organic metrics grid, explicitly label "Organic Impressions", "Organic Reach", "Organic Video Views"

### File 3: `src/components/clients/ClientDashboard.tsx`

**Fix Hero KPI double-counting:**
- When computing `totalReach`, use `reach` from Facebook (now guaranteed organic-only)
- No change needed for Meta Ads — it already stores its own paid reach
- The sum across platforms is now correct: FB organic reach + Meta Ads paid reach + other platforms = no overlap
- Same logic for `totalVideoViews`: FB now stores `video_views` as organic-only, Meta Ads stores paid video views separately

### File 4: `src/types/database.ts`

- Add `paid_impressions`, `paid_reach`, `paid_video_views` to any relevant metric lists so they can appear in the Facebook platform section config

## Key Design Decisions

1. **Use native organic metrics, not subtraction** — `page_impressions_organic_unique` and `page_video_views_organic` are provided by Facebook specifically for this purpose. Subtraction (`total - paid`) is only used for `impressions` where no direct organic-only metric exists at the impressions (non-unique) level.

2. **Store both organic and paid** — Don't discard paid data from Facebook. Users who boost posts (but don't have Meta Ads connected) need visibility into their boosted performance.

3. **Organic is the default display** — The main Facebook section shows organic metrics. Paid data appears in a clearly labeled sub-section.

4. **No double-counting** — The Hero KPIs sum `reach` across platforms. Since Facebook `reach` is now organic-only and Meta Ads `reach` is paid-only, summing them gives accurate total reach.

5. **Boosted post tagging** — Per-post insights now flag whether a post was boosted, allowing future features like "Boosted vs Organic post comparison".

## Scenarios Handled

| Scenario | Result |
|---|---|
| FB only, no boosting | All paid metrics = 0, organic = total, no boosted section shown |
| FB only, with boosted posts | Organic metrics shown in main section, boosted sub-section appears |
| FB + Meta Ads, no boosting | FB = pure organic, Meta Ads = pure paid, no overlap |
| FB + Meta Ads, with boosting | FB shows organic + boosted sub-section, Meta Ads shows campaign data — boosted posts may appear in both but metrics are correctly attributed |

