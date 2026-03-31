

# Fix: Facebook Top Posts Not Showing + TikTok Organic Sync

## Issues Found

### Issue 1: Facebook Top Posts Not Displaying
Facebook sync **does** populate `top_content` correctly in `monthly_snapshots`. The `collectPosts` function in `useClientDashboard.ts` reads `top_content` from snapshots and filters by `p.message || p.caption` for social posts. The Facebook posts have a `message` field, so they **should** appear.

However, looking at the query that fetches snapshots — it selects `top_content` from the DB. Let me verify this is actually being fetched. The `top_content` column is selected in the snapshot query. The posts are stored correctly. The `socialPosts` filter on line 220 of PlatformSection filters for `p.message || p.caption`. If posts have no `message` (e.g. photo-only posts), they'd be excluded. This is a data-level issue: posts with only images and no text are silently dropped from the "Top Posts" table.

**Fix:** Change the filter to also include posts that have `full_picture`, `permalink_url`, or any engagement data — essentially show all posts, not just ones with text.

### Issue 2: TikTok Organic — No Auto-Sync After Connection
Two sub-problems:

**2a. No initial 12-month sync triggered after OAuth.**  
When TikTok organic connects, the OAuth callback auto-selects the account (sets `account_id = openId`), so the redirect uses `oauth_connected`. The `oauthConnected` handler in `ClientDetail.tsx` (line 68-84) only shows a toast and calls `fetchData()` — it does NOT trigger `triggerInitialSync`. The 12-month sync only runs from `handlePickerComplete`, which fires on `oauth_pending_selection` (when user picks an account). Since TikTok auto-selects, the picker is never shown, and no sync runs.

**2b. `sync-tiktok-business` is actually an Ads API sync, not an organic sync.**  
The `sync-tiktok-business` edge function calls `business-api.tiktok.com/open_api/v1.3/report/integrated/get/` with an `advertiser_id`. This is the **TikTok Ads Reporting API** — it requires a Business API token and advertiser account. But organic TikTok uses Login Kit v2 tokens and an `open_id`, not an advertiser ID. So even if the sync triggered, it would fail because it's calling the wrong API entirely.

**Fix:** 
1. Rewrite `sync-tiktok-business` to use the TikTok Content Posting API / Login Kit v2 endpoints to fetch organic video data (video list, views, likes, comments, shares).
2. Add auto-sync trigger in `ClientDetail.tsx` for platforms that auto-select (like TikTok organic) when receiving `oauth_connected`.

---

## Plan

### Step 1: Fix Facebook top posts filter
**File:** `src/components/clients/dashboard/PlatformSection.tsx`  
Change `socialPosts` filter from `p.message || p.caption` to also include posts with `full_picture` or `permalink_url` or any engagement. This ensures photo/video-only posts appear in the table. Add a fallback display text like "(No caption)" for posts without text.

### Step 2: Rewrite `sync-tiktok-business` for organic TikTok
**File:** `supabase/functions/sync-tiktok-business/index.ts`  
Replace the Ads Reporting API calls with TikTok Login Kit v2 endpoints:
- Use `https://open.tiktokapis.com/v2/video/list/` to fetch the user's videos published in the target month
- Extract per-video metrics: `view_count`, `like_count`, `comment_count`, `share_count`
- Aggregate into `metrics_data`: `video_views`, `likes`, `comments`, `shares`, `engagement`, `posts_published`
- Store individual videos in `top_content` for the post performance table
- Remove the `account_id` advertiser check (organic uses `open_id`)
- Log as platform `tiktok` (not `tiktok_ads`)

### Step 3: Trigger 12-month auto-sync for auto-selected connections
**File:** `src/pages/clients/ClientDetail.tsx`  
In the `oauthConnected` handler (around line 68), after fetching connection data, check if the connection has `account_id` set and no existing snapshots for that platform. If so, call `triggerInitialSync` with the progress tracking — same logic as `handlePickerComplete` but triggered from the `oauth_connected` path.

---

## Technical Details

- TikTok Login Kit v2 video list endpoint: `POST https://open.tiktokapis.com/v2/video/list/` with `Authorization: Bearer {access_token}` and fields `id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration`
- Token refresh: Login Kit tokens expire in 24h; the `refresh_token` (valid 1 year) is stored in `platform_connections`. The sync function should attempt a token refresh if the API returns 401.
- The `CONNECT_FUNCTION_MAP` for TikTok organic (`tiktok → tiktok-ads-connect`) is confusingly named but works correctly — no change needed there.
- Facebook `socialPosts` filter change is minimal: just broaden the condition.

**Files modified:** 3 files (1 edge function rewrite, 2 frontend fixes)

