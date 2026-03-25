

## Plan: Add Missing Facebook Metrics + Full Post Content

### What's Missing (from Meta Business Suite screenshots)

1. **Link clicks** (357 in screenshot) — not fetched at all
2. **Page visits** (67 in screenshot) — not fetched at all  
3. **Full post content with images** — currently stores only truncated message text, no images, no reach per post, no permalink

### Changes

#### File: `supabase/functions/sync-facebook-page/index.ts`

**Add page-level metrics:**
- Fetch `page_views_total` (period=day) — this is the "Visits" metric, still valid in v25
- Fetch `page_consumptions` (period=day) — this counts content clicks including link clicks

**Enhance post fetching for full content:**
- Add `permalink_url` to post fields
- Add inline post insights: `insights.metric(post_impressions_unique,post_clicks){values}` to get per-post reach and clicks
- Store `full_picture` (already fetched but not saved to top_content)
- Store ALL posts for the month (increase limit to 100, paginate if needed), not just top 10
- Each post in `top_content` gets: `message` (full, not truncated), `created_time`, `full_picture`, `permalink_url`, `likes`, `comments`, `shares`, `reach`, `clicks`, `total_engagement`

**Update metricsData output:**
- Add `link_clicks` (from page_consumptions or sum of post clicks)
- Add `page_visits` (from page_views_total)

**Post data structure in top_content:**
```json
{
  "message": "Full post text...",
  "created_time": "2026-03-23T18:06:00+0000",
  "full_picture": "https://...",
  "permalink_url": "https://facebook.com/...",
  "likes": 0,
  "comments": 0,
  "shares": 0,
  "reach": 9,
  "clicks": 2,
  "total_engagement": 0
}
```

### Files to modify
1. `supabase/functions/sync-facebook-page/index.ts` — add metrics + enhance post data

