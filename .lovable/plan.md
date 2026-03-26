

# Data Integrity Audit & Fixes

## Issues Found

### 1. YouTube `video_views` stores ALL-TIME channel views, not monthly
**File:** `supabase/functions/sync-youtube/index.ts` line 141
```typescript
metricsData.video_views = parseInt(channelData.items[0].statistics.viewCount || "0", 10);
```
This fetches the **lifetime total view count** from the YouTube channel statistics API (e.g. 13,000+) and stores it as `video_views`. This is wrong — it should use the monthly `views` value from YouTube Analytics (line 113: `views: row[0] || 0`) which is the actual monthly view count (316).

**Fix:** Change `video_views` to use the monthly analytics value instead of the all-time channel stat:
```typescript
// Remove: metricsData.video_views = parseInt(channelData.items[0].statistics.viewCount)
// The monthly views from analytics (line 113) IS the correct video views for the period
metricsData.video_views = metricsData.views; // already set on line 113
```

### 2. Facebook platform section doesn't show `video_views` metric
**File:** `src/components/clients/dashboard/PlatformSection.tsx` line 78
`SOCIAL_KEY_METRICS` does not include `video_views`. Facebook sync DOES store `video_views` (line 307 of sync function), but the dashboard hides it because it's not in the key metrics list.

**Fix:** Add `video_views` to `SOCIAL_KEY_METRICS`:
```typescript
const SOCIAL_KEY_METRICS = ['reach', 'impressions', 'engagement', 'likes', 'comments', 'shares', 'total_followers', 'follower_growth', 'profile_visits', 'website_clicks', 'video_views', 'saves', 'reel_count'];
```

Also add `video_views` to `YOUTUBE_KEY_METRICS`:
```typescript
const YOUTUBE_KEY_METRICS = ['views', 'video_views', 'watch_time', 'subscribers', 'likes', 'comments', 'avg_view_duration'];
```

### 3. GSC CTR stored as decimal but displayed as percentage
**File:** `supabase/functions/sync-google-search-console/index.ts` line 152
The GSC API returns CTR as a decimal (e.g. 0.008 = 0.8%). The sync stores it raw: `search_ctr: avgCtr`.

**File:** `src/components/clients/dashboard/PlatformSection.tsx` line 98/103
The display code treats `search_ctr` as already a percentage and just appends `%`, showing `0.0%` instead of `0.8%`.

**Fix:** Convert CTR to percentage during sync:
```typescript
search_ctr: avgCtr * 100, // API returns decimal, store as percentage
```

### 4. GSC Average Position shows wrong value (137 vs actual 45.7)
The GSC API query uses `rowLimit: 1` with no dimensions, which should return the aggregate. The position value 137 suggests the data is from a different period or the API is returning weighted position differently. The 3-month view in the screenshot shows 45.7.

**Root cause:** The dashboard is showing a single month (February 2026), not 3 months. The position for that single month could legitimately be 137 if most impressions came from low-ranking queries. However, the user's GSC screenshot shows 3 months of data. This is a data period mismatch, not a code bug. The fix for CTR will resolve the most visible issue.

### 5. GSC chart shows only `search_clicks` — should show all 4 metrics
**File:** `src/components/clients/dashboard/PlatformSection.tsx` line 221
```typescript
const chartMetricKey = ... platform === 'google_search_console' ? 'search_clicks' : ...
```
Only one metric is charted. The user wants all 4 GSC metrics (impressions, clicks, CTR, position) on the trend chart, similar to Google's own Performance view.

**Fix:** For GSC, render a multi-line chart with all 4 metrics instead of a single metric area chart. Add special handling in the chart section to render multiple lines for GSC.

### 6. Facebook posts show `video_views` in top_content but stored differently
Facebook sync stores video views at the aggregate level (`metricsAccum.video_views`) but does NOT store `video_views` per post in the `allTopPosts` array. Each post only has likes, comments, shares, reach, clicks.

**Fix:** Add `video_views` per-post data. Facebook posts fetched via `published_posts` don't directly have video views. We need to fetch video insights for video posts separately, similar to how Instagram does it. For posts that are videos, fetch `post_video_views` from the post insights.

### Summary of Changes

| File | Change |
|---|---|
| `supabase/functions/sync-youtube/index.ts` | Use monthly `views` for `video_views` instead of all-time channel stats |
| `supabase/functions/sync-google-search-console/index.ts` | Multiply CTR by 100 before storing |
| `supabase/functions/sync-facebook-page/index.ts` | Add per-post video view count from post insights |
| `src/components/clients/dashboard/PlatformSection.tsx` | Add `video_views` to social key metrics; add multi-line GSC chart |

After deploying these fixes, a re-sync of YouTube, GSC, and Facebook will be needed to correct the stored data.

