

## Fix TikTok Data Extraction & Dashboard Display

### Problem
1. The `metric_defaults` table has TikTok configured with **ad metrics** (spend, impressions, clicks, etc.) — completely wrong for an organic platform
2. The sync function requests `profile_view_count` and `bio_link_click_count` which require the **`user.insights` scope** (not approved) — these will silently return 0
3. Missing METRIC_LABELS for `total_video_count`, `total_likes_received`, `following`
4. The `share_url` field from video.list is not being fetched — needed for linking to original posts in the Performance by Post table
5. Top content items don't include `permalink_url` for TikTok videos

### Changes

#### 1. Update `metric_defaults` for TikTok (database)
Replace the current ad-focused defaults with organic metrics that match what we actually collect:
- **available_metrics**: `total_followers`, `following`, `video_views`, `reach`, `likes`, `comments`, `shares`, `engagement`, `engagement_rate`, `videos_published`, `total_video_count`, `total_likes_received`, `profile_views`, `bio_link_clicks`, `completion_rate`, `average_time_watched`
- **default_metrics**: `total_followers`, `video_views`, `reach`, `likes`, `comments`, `shares`, `engagement`, `engagement_rate`, `videos_published`

#### 2. Update `sync-tiktok-ads/index.ts`
- Remove `profile_view_count` and `bio_link_click_count` from the user info API call (requires unapproved `user.insights` scope)
- Add `share_url` to the video list fields request
- Include `share_url` as `permalink_url` in the top_content and enriched video objects so the Performance by Post table can link to the original TikTok video
- Add `total_engagement` calculation per video for proper sorting in the post table

#### 3. Update `src/types/database.ts`
- Add missing METRIC_LABELS: `total_video_count` → "Total Videos", `total_likes_received` → "Total Likes Received", `following` → "Following"

#### 4. Update `src/components/clients/ClientDashboard.tsx`
- Add TikTok video views to the hero KPI row when TikTok is the selected platform (similar to how Spend only shows for ad platforms)

