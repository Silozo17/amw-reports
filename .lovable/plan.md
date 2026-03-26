
Fix only the data path for Facebook, Instagram, and YouTube video views and per-post reach, with a strict platform-by-platform audit and no unrelated changes.

## What I found

### 1. YouTube is mostly fixed already
The stored March/February YouTube snapshots for this client show:
- `views: 307 / 316`
- `video_views: 307 / 316`

So the YouTube monthly total now matches the expected source data. The remaining work for YouTube is to verify the hero/widget pipeline and make sure top-video rows and hero aggregation keep using monthly snapshot values only.

### 2. Instagram is still wrong
Current Instagram sync is using deprecated media metrics:
- It requests `video_views` on `/media`
- It requests `video_views` and `impressions` on `/{media-id}/insights`

The current Meta docs now say:
- `video_views` is deprecated
- `views` is the replacement metric
- `impressions` is deprecated for newer media
- `reach` is still valid for FEED/REELS/STORY

This explains why your stored Instagram snapshot shows:
- `video_views: 0`
- top reel rows also have `video_views: 0`
- per-post reach is not even persisted into top content

### 3. Facebook is still wrong
Current Facebook sync has two reliability problems:
- page-level `video_views` is built from `/video_posts` + `total_video_views`, which is lifetime-oriented and not aligned to the report month
- per-post reach is pulled from inline `published_posts ... insights.metric(post_impressions_unique,post_clicks)` but stored posts currently show `reach: 0` across the board

That means both:
- platform card video views are wrong/zero
- top post reach is wrong/zero
- hero “Video Views” misses Facebook contribution

## Implementation plan

### A. Rebuild Instagram sync to use current supported metrics
File: `supabase/functions/sync-instagram/index.ts`

Replace deprecated logic with current-compatible logic:

1. For top media fetch:
- include `media_product_type` if available
- stop depending on `video_views`
- use `views` for video/reel media
- use `reach` for per-post reach
- do not request deprecated `impressions` for media-level metrics where it can fail

2. For each media item:
- request insights using supported metrics per media type
- for REELS/VIDEO: fetch `views,reach,saved`
- for FEED image/carousel posts: fetch `reach,saved`
- gracefully skip unsupported metrics per media type instead of failing the whole sync

3. Persist per-post fields consistently into `top_content`:
- `reach`
- `video_views` (mapped from `views`)
- `media_type`
- `permalink_url`
- thumbnail/image

4. Aggregate monthly Instagram `metrics_data.video_views` from per-post `views`, not deprecated fields.

Expected outcome:
- Instagram platform card shows real video views
- Instagram top posts table shows reach and views
- hero video widget can include Instagram

### B. Rebuild Facebook per-post metrics for reliability
File: `supabase/functions/sync-facebook-page/index.ts`

1. Stop trusting the current inline `published_posts ... insights.metric(...)` result as the single source for reach.
2. For each post returned from `published_posts`:
- fetch post insights directly from `/{post-id}/insights`
- read `post_impressions_unique` for post reach
- read `post_clicks` for clicks
- for video/reel posts, fetch video-related metrics only when supported

3. Split Facebook video handling into:
- per-post video views for post table rows
- monthly aggregated video views built only from posts created in the selected month, not page lifetime video totals

4. If page/reel/video endpoints return different supported metrics, normalize all of them into:
- `reach`
- `video_views`
for storage in `top_content`

5. Keep page-level impression/reach logic separate from post-level reach logic so the dashboard cards and the top-post table are both correct.

Expected outcome:
- Facebook top posts get real per-post reach
- Facebook video posts get real per-post views
- monthly Facebook `metrics_data.video_views` becomes period-correct
- hero video widget can include Facebook

### C. Verify YouTube pipeline and lock it down
Files:
- `supabase/functions/sync-youtube/index.ts`
- `src/components/clients/ClientDashboard.tsx`
- `src/components/clients/dashboard/PlatformSection.tsx`

1. Keep YouTube using monthly analytics `views` as `video_views`.
2. Make the sync set `video_views` even if channel statistics fetch fails.
3. Confirm hero aggregation only sums `metrics_data.video_views` from snapshots.
4. Confirm top videos table prefers monthly row `views` and does not mix lifetime stats.

Expected outcome:
- no regression on YouTube
- hero widget continues to show YouTube only when it genuinely has data
- once IG/FB are fixed, their icons will appear too

### D. Normalize social top-content shape across platforms
Files:
- `supabase/functions/sync-instagram/index.ts`
- `supabase/functions/sync-facebook-page/index.ts`
- possibly small UI-only adjustments in `PlatformSection.tsx`

Standardize stored post objects so Facebook and Instagram both always provide:
```text
message/caption
created_time/timestamp
full_picture
permalink_url
likes
comments
shares/saves
reach
video_views
total_engagement
media_type
```

This removes mismatch bugs in the shared top-post table.

### E. Keep the UI minimal and correct
Files:
- `src/components/clients/dashboard/PlatformSection.tsx`
- `src/components/clients/ClientDashboard.tsx`

UI changes should be small:
1. Keep the top-posts table using `reach` and `video_views`.
2. Ensure zero is shown as `0` only when a post truly has a known zero, and show `—` when metric is unavailable.
3. Do not change widget logic beyond what is needed for correct source aggregation.

## Data repair / resync plan

After code changes, I would re-sync these platforms for the affected client:
1. Instagram
2. Facebook
3. YouTube verification pass

Because old snapshots already contain bad stored values:
- Instagram `video_views: 0`
- Facebook post `reach: 0`
- Facebook monthly `video_views: 0`

So a resync is required to repair historical monthly snapshots.

## Technical notes

```text
Current confirmed problems:
- Instagram uses deprecated `video_views`
- Instagram does not persist per-post reach
- Facebook per-post reach currently stores as 0
- Facebook monthly video views use the wrong source
- YouTube monthly totals look correct in stored data
```

```text
Primary files to update:
- supabase/functions/sync-instagram/index.ts
- supabase/functions/sync-facebook-page/index.ts
- supabase/functions/sync-youtube/index.ts
- src/components/clients/dashboard/PlatformSection.tsx
- src/components/clients/ClientDashboard.tsx
```

## Scope for this iteration
I will focus only on:
- Facebook video views
- Instagram video views
- YouTube verification/no-regression
- individual post reach for Facebook and Instagram
- hero widget source correctness for video views

I will not touch unrelated integrations in this pass.
