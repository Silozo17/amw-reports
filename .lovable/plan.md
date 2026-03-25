

## Fix TikTok Connection + Enhance Data Sync

### Redirect URI Issue

Your TikTok app's **Advertiser redirect URL** is set to `https://reports.amwmedia.co.uk`, but the code redirects to:

```text
https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback
```

**You need to add this URL** to your TikTok app's redirect URIs. However, the screenshot shows the **TikTok Business/Marketing API** portal (Advertiser authorization). Your integration uses **Login Kit v2** (Content API for organic data). Make sure the redirect URI is also set under the **Login Kit** configuration section in the TikTok Developer Portal, not just the Advertiser section.

Also, the `TIKTOK_APP_ID` secret needs to match the App ID shown: `7621075995757084688`. I'll update this secret value.

### Enhanced Data Sync

Comparing the DashThis screenshot to what we currently pull, here's what's missing:

| Metric | Status | How to get it |
|--------|--------|---------------|
| Reach / Views | Already synced | `video.list` view_count |
| Likes, Comments, Shares | Already synced | `video.list` |
| Total Followers | Already synced | `user.info.stats` |
| Engagement Rate | Already synced | Calculated |
| **Completion Rate** | Missing | `video.insights` API — `avg_time_watched` / `duration` |
| **Average Time Watched** | Missing | `video.insights` API — `average_time_watched` field |
| **Profile Views** | Missing | `user.insights` API — requires `user.insights` scope (already requested) |
| **Bio Link Clicks** | Missing | `user.insights` API — `bio_link_click` metric |
| Videos Published | Already synced | Count of videos in period |

### Changes

#### 1. `supabase/functions/sync-tiktok-ads/index.ts` — Pull additional metrics

**Add video insights** (after fetching video list):
- For each video in the period, call `POST https://open.tiktokapis.com/v2/video/query/?fields=id,avg_time_watched,total_time_watched,impression_sources,audience_countries` with the video IDs
- Calculate `completion_rate` per video as `avg_time_watched / duration * 100`
- Calculate overall `average_time_watched` across all videos

**Add user insights** (new API call):
- Call `GET https://open.tiktokapis.com/v2/user/info/?fields=profile_view_count,bio_link_click_count` (if available via `user.insights` scope)
- Store `profile_views` and `bio_link_clicks` in metrics_data

**Updated metricsData shape:**
```typescript
{
  // existing
  total_followers, reach, video_views, likes, comments, shares,
  engagement, engagement_rate, videos_published,
  // new
  completion_rate,        // avg across all videos
  average_time_watched,   // in seconds, avg across all videos  
  profile_views,          // from user insights
  bio_link_clicks,        // from user insights
}
```

**Updated top_content per video:**
```typescript
{
  // existing: id, title, description, views, likes, comments, shares, cover_image_url, create_time
  // new:
  avg_time_watched,    // seconds
  completion_rate,     // percentage
  reach,               // alias for views (matching DashThis column name)
}
```

#### 2. Update `TIKTOK_APP_ID` secret
- Set to `7621075995757084688` to match the TikTok Developer Portal

### User Action Required
1. Go to TikTok Developer Portal → your app → **Login Kit** settings
2. Add redirect URI: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
3. Confirm the `TIKTOK_APP_ID` secret update

### Files to modify
1. `supabase/functions/sync-tiktok-ads/index.ts` — add video insights + user insights calls

