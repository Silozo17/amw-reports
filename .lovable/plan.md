

## Full Analysis: All 10 Integrations vs DashThis

### What DashThis Shows Per Platform (from screenshots)

```text
FACEBOOK INSIGHTS (organic page)
├── Page Likes (total)
├── New Page Likes (period)
├── Page Impressions
├── Engagement (total interactions)
├── Page Engagement Rate (%)
├── Top Posts by Impressions (image, text, impressions, engaged)
└── Page Views (monthly bar chart)

INSTAGRAM (organic)
├── Total Followers
├── Profile Views
├── Website Clicks
├── Engagement by Post (name, likes, comments)
└── Performance by Post (engagement, impressions, reach, engagement rate)

LINKEDIN (organic pages only — NO ads)
├── Total Followers
├── Social Interactions (likes+comments+shares)
├── Impressions
├── Clicks
└── Engagement Rate (%)

YOUTUBE (organic)
├── Subscribers
├── Video Views (total + pie chart breakdown by video)
└── Top Videos table (title, views)

TIKTOK (organic — NOT ads)
├── Reach
├── Likes
├── Comments
├── Engagement
├── Engagement Rate (%)
├── Completion Rate (%)
├── Average Time Watched
├── Website Clicks
├── Total Followers
├── Profile Views
├── Bio Link Clicks
└── Video Views Breakdown (thumbnail, views, likes, reach, profile views)

GSC
├── Clicks
├── Impressions
├── Avg CTR (%)
├── Avg Position
└── Top Queries table (query, clicks, impressions, ctr, position)

GOOGLE MY BUSINESS
├── Total Views (monthly chart)
├── Website Clicks
├── Phone Calls
├── Views on Maps
└── Directions Requests

META ADS (paid only)
├── Amount Spent
├── CPC
├── Link Clicks
└── Impressions

GOOGLE ADS (paid only)
└── (not shown in screenshots but same pattern: spend, clicks, impressions, conversions)
```

### Current Status of Each Integration

```text
Platform        Connect  Callback  Sync     Secrets   Status
──────────────  ───────  ────────  ───────  ────────  ─────────────────────
Facebook        OK       OK        OK       OK        WORKING (organic)
Instagram       OK       OK        OK       OK        WORKING (organic)
Meta Ads        OK       OK        OK       OK        WORKING (paid)
Google Ads      OK       OK        OK       OK        WORKING (paid)
GA4             OK       OK        OK       OK        WORKING
GSC             OK       OK        OK       OK        WORKING
GBP             OK       OK        OK       OK        WORKING
YouTube         OK       OK        OK       OK        WORKING
LinkedIn        OK       OK        WRONG    MISSING   BROKEN (2 issues)
TikTok          OK       WRONG     WRONG    OK        BROKEN (2 issues)
```

### Issues Found

**1. TikTok — 2 critical mismatches**

The connect function correctly uses Login Kit v2 (`tiktok.com/v2/auth/authorize/` with organic scopes). But:

- **OAuth callback** (handleTikTok): Exchanges code via Marketing API (`business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`). Login Kit v2 tokens MUST be exchanged at `https://open.tiktokapis.com/v2/oauth/token/` using `client_key`/`client_secret` with `grant_type=authorization_code`. The response format is also different: `{ access_token, open_id, scope, expires_in }` not `{ code: 0, data: { access_token, advertiser_ids } }`.

- **Sync function** (`sync-tiktok-ads`): Pulls paid ad campaign data (spend, impressions, clicks, campaigns) via Marketing API. This is completely wrong for organic TikTok. Should use TikTok Content API v2:
  - `GET https://open.tiktokapis.com/v2/user/info/` for follower count, profile views, bio link clicks
  - `GET https://open.tiktokapis.com/v2/video/list/` for video-level data (views, likes, comments, shares, reach, avg watch time)
  - Uses `Authorization: Bearer {token}` header (not `Access-Token`)

**2. LinkedIn — 2 issues**

- **Missing secrets**: `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are not configured. LinkedIn will fail at token exchange.

- **Sync function pulls ad data**: The current `sync-linkedin` fetches ad account analytics (spend, impressions, clicks, conversions) AND organic page stats. Per the user's requirement, LinkedIn should be **pages only** — no ads. The sync should only pull: followers, social interactions, organic impressions, organic clicks, engagement rate. The connect scopes also include `r_ads` and `r_ads_reporting` which aren't needed.

**3. TikTok — ORGANIC_PLATFORMS not updated**

`database.ts` has `ORGANIC_PLATFORMS` set but `tiktok` is NOT in it. Since TikTok is organic-only, it needs to be added so ad metrics (spend, cpc, cpm) are hidden from the dashboard.

---

### Changes Required

#### Fix 1: TikTok OAuth Callback — Rewrite for Login Kit v2
**File:** `supabase/functions/oauth-callback/index.ts` (handleTikTok)
- Change token exchange URL to `https://open.tiktokapis.com/v2/oauth/token/`
- Use POST with `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`
- Parse response as `{ access_token, open_id, scope, expires_in, token_type }`
- Store `open_id` in metadata (user identifier for Content API)
- Remove advertiser discovery entirely

#### Fix 2: TikTok Sync — Complete rewrite for organic content
**File:** `supabase/functions/sync-tiktok-ads/index.ts`
- Remove all Marketing API calls
- Use TikTok Content API v2 with `Authorization: Bearer {token}`:
  - `GET /v2/user/info/?fields=follower_count,following_count,likes_count,video_count` for account stats
  - `GET /v2/video/list/?fields=id,title,video_description,duration,cover_image_url,view_count,like_count,comment_count,share_count,create_time` for video data
- Aggregate metrics: reach (sum of views), likes, comments, shares, engagement, total followers
- Calculate engagement rate, completion rate (not available via API — omit for now), avg watch time (not directly available via v2 list endpoint — omit for now)
- Store video breakdown in `top_content`
- Remove `advertiser_id` requirement — use `open_id` from metadata
- Platform name stays `tiktok` in snapshots

#### Fix 3: TikTok Connect — Update scopes
**File:** `supabase/functions/tiktok-ads-connect/index.ts`
- Add missing scopes from DashThis: `user.info.username,user.info.stats,user.info.profile,user.account.type,comment.list`
- Full scope string: `user.info.basic,user.info.username,user.info.stats,user.info.profile,user.account.type,user.insights,video.list,video.insights,comment.list`

#### Fix 4: LinkedIn Sync — Remove ad data, pages only
**File:** `supabase/functions/sync-linkedin/index.ts`
- Remove all ad account analytics code (lines 80-107)
- Remove ad-related metrics from output (spend, clicks, conversions, ctr, cpc, cpm, cost_per_conversion, campaign_count)
- Keep: follower stats, organic post engagement (likes, comments, shares, impressions, clicks)
- Output metrics: `total_followers`, `engagement` (likes+comments+shares), `impressions` (organic), `clicks` (organic), `engagement_rate`, `likes`, `comments`, `shares`

#### Fix 5: LinkedIn Connect — Remove ad scopes
**File:** `supabase/functions/linkedin-connect/index.ts`
- Change scope from `r_ads r_ads_reporting r_organization_social r_organization_admin` to `r_organization_social rw_organization_admin r_basicprofile`
- Match DashThis scopes (from URL analysis): `r_basicprofile,rw_organization_admin,r_organization_social`

#### Fix 6: LinkedIn Callback — Remove ad account discovery
**File:** `supabase/functions/oauth-callback/index.ts` (handleLinkedIn)
- Remove ad account discovery (lines 502-526)
- Keep organization discovery
- Store only `organizations` in metadata (no `ad_accounts`)

#### Fix 7: Add tiktok to ORGANIC_PLATFORMS
**File:** `src/types/database.ts`
- Add `'tiktok'` to the `ORGANIC_PLATFORMS` set

#### Fix 8: Request LinkedIn secrets
- Use `add_secret` to request `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`

### Files to modify:
1. `supabase/functions/oauth-callback/index.ts` — Rewrite handleTikTok, simplify handleLinkedIn
2. `supabase/functions/sync-tiktok-ads/index.ts` — Complete rewrite for organic Content API
3. `supabase/functions/tiktok-ads-connect/index.ts` — Update scopes
4. `supabase/functions/sync-linkedin/index.ts` — Remove ad analytics, pages only
5. `supabase/functions/linkedin-connect/index.ts` — Remove ad scopes
6. `src/types/database.ts` — Add tiktok to ORGANIC_PLATFORMS

### What is already correct (no changes needed):
- Facebook connect/callback/sync — organic pages, working
- Instagram connect/callback/sync — organic, working
- Meta Ads connect/callback/sync — paid ads only, working
- Google Ads connect/callback/sync — paid ads, working
- GA4 connect/callback/sync — working
- GSC connect/callback/sync — working
- GBP connect/callback/sync — working
- YouTube connect/callback/sync — working
- ConnectionDialog.tsx — all platforms already listed
- AccountPickerDialog.tsx — already handles all platforms

### Secrets status:
- `GOOGLE_CLIENT_ID` — present
- `GOOGLE_CLIENT_SECRET` — present
- `GOOGLE_ADS_DEVELOPER_TOKEN` — present
- `META_APP_SECRET` — present
- `TIKTOK_APP_ID` — present
- `TIKTOK_APP_SECRET` — present
- `LINKEDIN_CLIENT_ID` — **MISSING** (must request)
- `LINKEDIN_CLIENT_SECRET` — **MISSING** (must request)

