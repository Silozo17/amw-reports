

# Fix Instagram Top Post Images Not Pulling In

## Root Cause

The Instagram sync edge function (`sync-instagram/index.ts`) fetches media but **never stores the image URL or permalink** in `top_content`. Specifically:

1. **Line 192**: The API request includes `thumbnail_url` but NOT `media_url` or `permalink`
2. **Lines 218-228**: When building the `allTopMedia` array, neither `thumbnail_url`, `media_url`, nor `permalink` are mapped — they're simply dropped
3. **Frontend expects `full_picture`**: The `PlatformSection.tsx` component renders images using the `full_picture` field (line 384), which is always `undefined` for Instagram posts

For comparison, the Facebook sync correctly stores `full_picture` and `permalink_url` from the API response.

## Fix

### 1. `supabase/functions/sync-instagram/index.ts`

**Line 192** — Add `media_url,permalink` to the fields parameter:
```
fields=caption,timestamp,like_count,comments_count,media_type,media_url,thumbnail_url,permalink&since=...
```

**Lines 218-228** — Map image and permalink into the stored object:
```typescript
allTopMedia.push({
  caption: (m.caption || "").substring(0, 100),
  timestamp: m.timestamp,
  likes: m.like_count || 0,
  comments: m.comments_count || 0,
  saves: m.saves || 0,
  video_views: m.video_views || m.video_views_insight || 0,
  profile_activity: m.profile_activity || 0,
  media_type: m.media_type,
  full_picture: m.media_url || m.thumbnail_url || null,  // ADD
  permalink_url: m.permalink || null,                      // ADD
  total_engagement: (m.like_count || 0) + (m.comments_count || 0) + (m.saves || 0),
});
```

- `media_url` is the direct image/video URL from Instagram's Graph API
- `thumbnail_url` is the fallback for video posts
- `permalink` links to the post on Instagram

### 2. Re-sync data

After deploying the updated function, re-trigger Instagram syncs for all active connections (current month) so `top_content` is re-populated with image URLs.

### No frontend changes needed

The `PlatformSection` already handles `full_picture` rendering with a fallback icon when missing.

| File | Change |
|------|--------|
| `supabase/functions/sync-instagram/index.ts` | Add `media_url,permalink` to API fields; map to `full_picture` and `permalink_url` in stored data |

