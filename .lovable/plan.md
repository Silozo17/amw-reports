

## Plan: Add YouTube Analytics, Configure TikTok Secrets, and Add Platform Logos

---

### 1. YouTube Analytics Integration

YouTube Analytics API is already enabled. This follows the same pattern as GSC/GA/GBP — OAuth connect, callback discovery, sync function.

**Database migration:**
- Add `youtube` to `platform_type` enum
- Insert `metric_defaults` row for YouTube with metrics: `subscribers`, `views`, `watch_time`, `likes`, `comments`, `shares`, `videos_published`, `impressions`, `ctr`, `avg_view_duration`, `top_videos`

**New edge functions:**
- `supabase/functions/youtube-connect/index.ts` — OAuth with scope `https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly`
- `supabase/functions/sync-youtube/index.ts` — Queries YouTube Analytics API (`https://youtubeanalytics.googleapis.com/v2/reports`) for monthly metrics: views, watch time, subscribers gained/lost, likes, comments, shares, impressions, CTR, avg view duration. Also fetches top videos via YouTube Data API.

**OAuth callback update:**
- Add `handleYouTube` case in `oauth-callback/index.ts` — exchanges code, discovers channels via `https://www.googleapis.com/youtube/v3/channels?mine=true`

**Frontend updates:**
- Add `youtube` to `PlatformType` union, `PLATFORM_LABELS`, `PLATFORM_LOGOS`, `ORGANIC_PLATFORMS`
- Add to `ConnectionDialog.tsx` PLATFORMS array, OAUTH_SUPPORTED, CONNECT_FUNCTION_MAP
- Add YouTube metric explanations to `src/types/metrics.ts`
- Add YouTube to `AccountPickerDialog.tsx` (channel selection)
- Add YouTube to `ConnectionDisclaimer.tsx`

---

### 2. TikTok — Secrets Setup

The TikTok integration code is already fully built (connect function, OAuth callback handler, sync function). What's missing are two secrets:

- **`TIKTOK_APP_ID`** — The App ID from your TikTok for Business Developers dashboard (shown in the screenshot: `7621075995757084688`)
- **`TIKTOK_APP_SECRET`** — The Secret from the same dashboard

I will use the `add_secret` tool to prompt you to enter both values. Once set, TikTok OAuth will work immediately.

**Additionally**, the TikTok OAuth redirect URI in your TikTok Developer dashboard must include your backend callback URL:
```
https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback
```
From the screenshot, the current redirect URL is `https://reports.amwmedia.co.uk` — you need to add the callback URL above as an additional Advertiser redirect URL in TikTok Developer portal.

---

### 3. Platform Logos

Copy the uploaded logo images to `src/assets/logos/` and update `PLATFORM_LOGOS` in `database.ts`:

- `google-search-console-icon.webp` → `src/assets/logos/google-search-console.webp` → used for `google_search_console`
- `Google-Analytics-Logo.webp` → `src/assets/logos/google-analytics.webp` → used for `google_analytics`
- `google_business_logo.webp` → `src/assets/logos/google-business.webp` → used for `google_business_profile`
- `Youtube-logo-vector-PNG.webp` → `src/assets/logos/youtube.webp` → used for `youtube`

Update imports and `PLATFORM_LOGOS` map entries to use dedicated logos instead of the generic Google logo.

---

### Files Summary

**New files:**
- `supabase/functions/youtube-connect/index.ts`
- `supabase/functions/sync-youtube/index.ts`
- `src/assets/logos/google-search-console.webp` (copied from upload)
- `src/assets/logos/google-analytics.webp` (copied from upload)
- `src/assets/logos/google-business.webp` (copied from upload)
- `src/assets/logos/youtube.webp` (copied from upload)

**Modified files:**
- `src/types/database.ts` — Add `youtube` to PlatformType, logos, labels
- `src/types/metrics.ts` — YouTube metric explanations
- `src/components/clients/ConnectionDialog.tsx` — Add `youtube`
- `src/components/clients/AccountPickerDialog.tsx` — YouTube channel picker
- `src/components/clients/ConnectionDisclaimer.tsx` — YouTube policy text
- `supabase/functions/oauth-callback/index.ts` — `handleYouTube` case
- `supabase/functions/generate-report/index.ts` — Add YouTube to PLATFORM_LABELS

**Database migration:**
- Extend `platform_type` enum with `youtube`
- Insert YouTube `metric_defaults`

**Secrets to add:**
- `TIKTOK_APP_ID`
- `TIKTOK_APP_SECRET`

