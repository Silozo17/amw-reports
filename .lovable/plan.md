

## Full Platform Data Audit & Fix Plan

### Audit Results by Platform

#### 1. Facebook (sync-facebook-page) — Complete
**Metrics stored:** impressions, organic_impressions, paid_impressions, total_impressions, reach, engagement, page_views, link_clicks, follower_growth, total_followers, video_views, likes, comments, shares, posts_published, engagement_rate, pages_count
**Top content:** All posts with message, created_time, full_picture, permalink_url, likes, comments, shares, reach, clicks, total_engagement
**Dashboard rendering:** All metrics display via PlatformMetricsCard. Posts render in "Performance by Post" table. Hero KPIs pick up reach, clicks, engagement, followers, link_clicks, page_views.
**Issues:** None. ✓

#### 2. Instagram (sync-instagram) — Complete
**Metrics stored:** impressions, reach, profile_visits, website_clicks, engagement, likes, comments, saves, video_views, posts_published, reel_count, image_count, carousel_count, engagement_rate, total_followers
**Top content:** Media items with caption, timestamp, likes, comments, saves, video_views, media_type, total_engagement
**Dashboard rendering:** All metrics display. Posts render in social posts table (but using `caption` not `message` — the table checks both). Hero KPIs pick up reach, engagement, followers.
**Issues:** None. ✓

#### 3. Meta Ads (sync-meta-ads) — Complete
**Metrics stored:** impressions, clicks, spend, conversions, conversions_value, ctr, cpc, cpm, cost_per_conversion, roas, reach, link_clicks, frequency, video_views, campaign_count
**Top content:** Top campaigns by spend (name, spend, clicks, impressions, conversions, ctr)
**Dashboard rendering:** All metrics display. Campaign top content doesn't render in social posts table (no message/caption) but this is expected — campaigns aren't posts.
**Issues:** None. ✓

#### 4. TikTok (sync-tiktok-ads) — Complete
**Metrics stored:** total_followers, following, reach, video_views, likes, comments, shares, engagement, engagement_rate, videos_published, total_video_count, total_likes_received, completion_rate, average_time_watched
**Top content:** Videos with title, description, cover image, permalink, views, reach, likes, comments, shares, total_engagement, create_time. Also mapped to `message` and `full_picture` fields for social post table compatibility.
**Dashboard rendering:** All metrics display. Videos render in social posts table. Hero KPIs pick up reach, engagement, followers, video_views.
**Issues:** None. ✓

#### 5. LinkedIn (sync-linkedin) — Has Issues
**Metrics stored:** total_followers, impressions, clicks, likes, comments, shares, engagement, engagement_rate, organizations_count
**Top content:** Empty array `[]` — no posts stored
**Issues:**
- **BUG A:** Posts are fetched but NOT filtered by date range. The sync fetches all posts for the org and aggregates all their stats, regardless of month/year. This means every month's snapshot contains the same lifetime totals, not monthly data.
- **BUG B:** No top_content is stored — the LinkedIn sync saves `top_content: []` despite fetching per-post stats. Individual post data is lost.
- **MISSING DATA:** LinkedIn UGC posts have content (text, images, links) that could be stored in top_content.

#### 6. Google Ads (sync-google-ads) — Complete
**Metrics stored:** impressions, clicks, spend, conversions, conversions_value, ctr, cpc, cpm, cost_per_conversion, roas, reach (always 0), conversion_rate, search_impression_share, campaign_count
**Top content:** Top campaigns by spend
**Dashboard rendering:** All metrics display correctly.
**Issues:** None. ✓

#### 7. Google Search Console (sync-google-search-console) — Complete
**Metrics stored:** search_clicks, search_impressions, search_ctr, search_position
**Top content:** Queries (query, clicks, impressions, ctr, position) + Pages (page, clicks, impressions, ctr, position) with `type` field
**Dashboard rendering:** Hero KPIs include search_clicks and search_impressions. Dedicated "Top Search Queries" and "Top Pages (Search)" tables.
**Issues:** None (data-wise). Needs sync to be triggered. ✓

#### 8. Google Analytics (sync-google-analytics) — Has Dashboard Bug
**Metrics stored:** sessions, active_users, new_users, ga_page_views, bounce_rate, avg_session_duration, pages_per_session
**Top content:** Pages stored with field name `page` + traffic sources stored with field name `source`
**Dashboard rendering:** Metrics display via PlatformMetricsCard. Hero KPIs pick up sessions and ga_page_views.
**Issues:**
- **BUG C:** Dashboard checks for `p.pagePath` but the sync stores it as `p.page`. The GA4 "Top Pages" and "Traffic Sources" tables will **never render** because the filter `p.pagePath || p.source` won't match `p.page`. The `pagePath` field in TopContentItem doesn't match what the sync stores.

#### 9. Google Business Profile (sync-google-business-profile) — Complete (pending API fix)
**Metrics stored:** gbp_views, gbp_searches, gbp_calls, gbp_direction_requests, gbp_website_clicks, gbp_reviews_count, gbp_average_rating
**Top content:** None (no posts concept for GBP)
**Dashboard rendering:** All metrics display via PlatformMetricsCard. Hero KPIs include gbp_views and gbp_website_clicks.
**Issues:** API quota = 0 (Google Cloud config, not a code bug). ✓ otherwise

#### 10. YouTube (sync-youtube) — Has Minor Issue
**Metrics stored:** views, watch_time, likes, comments, shares, subscribers, impressions, ctr, avg_view_duration, total_followers, video_views, videos_published
**Top content:** Top 5 videos with id, title, views, likes, comments
**Dashboard rendering:** Dedicated "Top Videos" table renders correctly (filters on `p.title`).
**Issues:**
- **BUG D:** YouTube sync uses `upsert` with `onConflict: "client_id,platform,report_month,report_year"` but there is NO unique constraint on those columns in the `monthly_snapshots` table. This means upsert will always insert a new row, creating duplicates. All other syncs use select-then-update/insert pattern correctly.

### Duplication Check
- Facebook organic vs Meta Ads: Facebook sync explicitly uses `page_media_view` with `is_from_ads` breakdown to separate organic from paid. `organicImpressions` is used as primary. No duplication. ✓
- YouTube `video_views` (lifetime from channel stats) vs `views` (period from analytics): These are different metrics. `views` = monthly analytics, `video_views` = all-time channel stat. Both stored but serve different purposes. ✓

### Changes Required

**1. Fix GA4 top content field name mismatch** (BUG C)
- In `src/components/clients/ClientDashboard.tsx`, update the GA4 top content filter from `p.pagePath` to `p.page`
- Update the rendering to use `item.page` instead of `item.pagePath`
- Also update the TopContentItem interface to add `page` field (it already has it from the GSC definition)

**2. Fix YouTube snapshot duplication** (BUG D)
- In `supabase/functions/sync-youtube/index.ts`, replace the `upsert` call with the standard select-then-update/insert pattern used by all other sync functions

**3. Fix LinkedIn date filtering and add top content** (BUG A & B)
- In `supabase/functions/sync-linkedin/index.ts`:
  - Filter UGC posts by creation date to only include posts from the target month
  - Store individual post data in top_content with text, permalink, likes, comments, shares, impressions, total_engagement
  - This ensures monthly data is accurate, not lifetime totals

**4. No other changes needed**
- All other sync functions correctly pull all available data
- All metric labels, explanations, and PlatformMetricsCard rendering are complete
- Hero KPI aggregation correctly includes all platform metric keys

### Files to modify
1. `src/components/clients/ClientDashboard.tsx` — fix GA4 `pagePath` → `page` field reference
2. `supabase/functions/sync-youtube/index.ts` — replace upsert with select-then-update/insert
3. `supabase/functions/sync-linkedin/index.ts` — add date filtering + store top_content

