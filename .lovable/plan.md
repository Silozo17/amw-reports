

# Facebook & Instagram Sync Fix

## Root Causes Found (from official Meta API documentation)

### Issue 1: Facebook — `type` field deprecated since v3.3

The FB sync (line 209) requests the `type` field on `published_posts`:
```
fields=message,created_time,full_picture,permalink_url,...,type
```

The `type` field was **deprecated in Graph API v3.3** (April 2019). On v25.0, this causes:
```
(#12) deprecate_post_aggregated_fields_for_attachement is deprecated for versions v3.3 and higher
```

This is the **exact error in the logs** — the entire posts request fails, meaning:
- **Zero top posts** are returned (hence no post table)
- **Zero video views** (aggregated from posts)
- **Zero post-level metrics** (likes, comments, shares)

The official docs say to use `attachments` instead. To detect video vs photo, use `attachments{media_type}` or check if the post has video-related properties.

### Issue 2: Instagram — `plays` metric deprecated since April 21, 2025

The IG sync (line 192) requests `plays` for video/reel media insights:
```
metric=plays,reach,saved
```

Per the official Instagram Media Insights documentation:
> `plays` — **Deprecated for v22.0 and for all versions on April 21, 2025.**

The replacement is the `views` metric, which works for `FEED`, `STORY`, and `REELS` media product types. Since we're on v25.0 and the date is March 2026, `plays` returns an error (silently caught), resulting in **zero video views**.

### Issue 3: Instagram — `video_views` metric also deprecated

The docs explicitly state: "The `video_views` metric has been deprecated." The new universal metric is `views`.

## Plan

### File 1: `supabase/functions/sync-facebook-page/index.ts`

**Fix the `type` field deprecation (line 209)**
- Remove `type` from the fields list
- Add `attachments{media_type,media,url,title}` to detect post type
- Determine video posts from `attachments.data[0].media_type === 'video'` instead of `post.type === 'video'`
- Keep `post_video_views` in per-post insights — this metric is still valid on v25.0 (confirmed in docs, line 599: "post_video_views ... lifetime, day")
- Also add `page_video_views` as a page-level insight fetch (period=day) for aggregate video views as a fallback/supplement

### File 2: `supabase/functions/sync-instagram/index.ts`

**Fix the `plays` deprecation (line 192)**
- Replace `plays` with `views` for all media types (FEED, REELS, VIDEO)
- The `views` metric works for ALL media product types (FEED, STORY, REELS), so use it universally instead of only for videos
- For video/reel posts: fetch `views,reach,saved`
- For image/carousel posts: fetch `reach,saved` (no change needed)
- Map the `views` metric value to `video_views` in the post data for videos/reels
- Remove the fallback block (lines 207-218) that tries deprecated metric names

### Summary of Changes

| File | Line | Current (broken) | Fix |
|---|---|---|---|
| `sync-facebook-page` | 209 | `type` field in published_posts | Replace with `attachments{media_type,media,url,title}` |
| `sync-facebook-page` | 224 | `post.type === 'video'` | `attachments.data[0].media_type === 'video'` |
| `sync-instagram` | 191-193 | `plays,reach,saved` | `views,reach,saved` |
| `sync-instagram` | 204 | `insight.name === 'plays'` | `insight.name === 'views'` |
| `sync-instagram` | 207-218 | Fallback to deprecated metrics | Remove fallback block |

