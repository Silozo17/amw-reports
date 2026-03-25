

## Fix TikTok Data Display on Dashboard

### Root Causes Identified

**1. Pagination breaks after first page (critical bug)**
The sync function checks `if (data.error?.code)` and breaks. TikTok returns `{"code":"ok","message":""}` for *successful* responses — the string `"ok"` is truthy, so pagination stops after 20 videos every time. Only 1 page of videos is ever processed.

**2. Post table shows empty fields for TikTok**
The dashboard's `TopContentItem` uses `message`/`caption`/`full_picture`/`created_time` (Facebook/Instagram field names). TikTok sync stores `title`/`description`/`cover_image_url`/`create_time` (unix timestamp). Result: no thumbnails, no captions, no dates for TikTok posts.

**3. Engagement is double-counted in hero KPIs**
The KPI calculation sums `engagement + likes + comments + shares`. For TikTok, `engagement` already equals `likes + comments + shares`, so every interaction is counted twice.

**4. Missing sparkline data for `video_views`**
The `sparklineMap` builder doesn't include `video_views`, so the TikTok "Video Views" hero card has no sparkline.

**5. Trend chart shows nothing for organic platforms**
The trend area chart only plots `impressions`, `clicks`, `spend` — TikTok has none of these. It should also plot `video_views` or `reach` when those are the relevant metrics.

### Changes

#### 1. Fix `supabase/functions/sync-tiktok-ads/index.ts`
- Change the error check from `if (data.error?.code)` to `if (data.error?.code && data.error.code !== "ok")` — this is the critical fix that restores full video pagination
- Map TikTok top_content fields to match the dashboard's expected field names: `message` (from title/description), `full_picture` (from cover_image_url), `created_time` (ISO string from unix timestamp)

#### 2. Fix `src/components/clients/ClientDashboard.tsx`
- **KPI engagement**: Avoid double-counting by using `engagement` OR `likes+comments+shares`, not both. When a platform provides a pre-aggregated `engagement` field, use that; otherwise sum the components
- **Sparkline map**: Add `video_views` to the sparkline builder so TikTok's hero card gets a trend line
- **Trend chart**: Add `video_views` as an additional area/line when data exists, so organic video platforms show meaningful trends

#### 3. No database changes needed
The `metric_defaults` were already updated in the previous round. The snapshot data structure is correct — the issues are in the sync pagination bug and field name mapping.

