

# Full Platform Integration Plan

## Current State

| Platform | OAuth Connect | Data Sync | Status |
|----------|--------------|-----------|--------|
| Google Ads | Yes | Yes | Working (Test mode) |
| Meta Ads | Yes | Yes | Working (needs scope fix + API v25.0 update) |
| Facebook Pages | Discovered via Meta OAuth | No sync function | Partial |
| Instagram Pages | Discovered via Meta OAuth | No sync function | Partial |
| TikTok Ads | Listed in UI only | Nothing built | Not started |
| LinkedIn Ads + Pages | Listed in UI only | Nothing built | Not started |

## What Needs to Be Done

### Phase 1: Fix Meta OAuth + Add Facebook/Instagram Sync

**1a. Fix Meta OAuth scopes and API version**
- `meta-ads-connect/index.ts`: Remove `instagram_basic`, update Facebook dialog URL from v21.0 to v25.0
- `oauth-callback/index.ts`: Update all Graph API URLs from v21.0 to v25.0
- `sync-meta-ads/index.ts`: Update `GRAPH_API_VERSION` from v21.0 to v25.0

**1b. Create `sync-facebook-page/index.ts`**
- Uses the Page access token from Meta OAuth metadata
- Pulls Page Insights: `page_views_total`, `page_post_engagements`, `page_impressions` (being replaced by `views`), `page_fan_adds` (follower growth)
- Pulls top posts via `/{page-id}/published_posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares`
- Stores in `monthly_snapshots` as platform `facebook`

**1c. Create `sync-instagram/index.ts`**
- Uses Instagram Business Account ID discovered during Meta OAuth
- Pulls IG Insights: `impressions`, `reach`, `profile_views`, `follower_count` via `/{ig-user-id}/insights`
- Pulls top media via `/{ig-user-id}/media?fields=caption,timestamp,like_count,comments_count,impressions,reach`
- Stores in `monthly_snapshots` as platform `instagram`

### Phase 2: Simplify the "Add Connection" Dialog

- Remove the Account Name and Account ID input fields
- Flow becomes: Select platform > Click "Add & Connect" > OAuth popup opens immediately
- For platforms without OAuth yet, just create the connection record in "Pending" state

### Phase 3: TikTok Ads Integration

**What you need to do first (in the TikTok Developer portal):**
1. Go to https://business-api.tiktok.com/portal and log in with your TikTok for Business account
2. Click "My Apps" > "Create an App"
3. Select "Marketing API" as the app type
4. Fill in app name, description, and your company info
5. Set the **Redirect URI** to: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
6. Request these permissions: "Ad Account Management" (read), "Ad Management" (read), "Reporting" (read)
7. Submit for review (TikTok reviews within 1-2 business days)
8. Once approved, copy your **App ID** and **App Secret** from the app details page

**What I will build:**
- `tiktok-ads-connect/index.ts`: Builds TikTok OAuth URL using `https://business-api.tiktok.com/portal/auth` with your App ID
- Update `oauth-callback/index.ts`: Add TikTok branch that exchanges auth_code for access_token via `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`, discovers advertiser accounts
- `sync-tiktok-ads/index.ts`: Pulls campaign metrics via `GET https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/` with metrics `spend`, `impressions`, `clicks`, `conversions`, `ctr`, `cpc`, `cpm`

**Secrets needed:** `TIKTOK_APP_ID` and `TIKTOK_APP_SECRET`

### Phase 4: LinkedIn Ads + Pages Integration

**What you need to do first (in the LinkedIn Developer portal):**
1. Go to https://www.linkedin.com/developers/ and log in
2. Click "Create App"
3. Fill in app name, LinkedIn Page (your company page), and logo
4. Under "Auth" tab, add the **Redirect URL**: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
5. Under "Products" tab, request access to:
   - **Advertising API** (for ads reporting) — gives you `r_ads` and `r_ads_reporting` scopes
   - **Community Management API** (for page analytics) — gives you `r_organization_social` and `r_organization_admin` scopes
6. LinkedIn reviews these requests (can take a few days)
7. Once approved, copy your **Client ID** and **Client Secret** from the "Auth" tab

**What I will build:**
- `linkedin-connect/index.ts`: Builds LinkedIn OAuth URL using `https://www.linkedin.com/oauth/v2/authorization` with scopes `r_ads,r_ads_reporting,r_organization_social,r_organization_admin`
- Update `oauth-callback/index.ts`: Add LinkedIn branch that exchanges code for token via `POST https://www.linkedin.com/oauth/v2/accessToken`, discovers ad accounts and organization pages
- `sync-linkedin/index.ts`: Pulls ad analytics via `GET https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN` and page statistics via `GET https://api.linkedin.com/rest/organizationalEntityFollowerStatistics`

**Secrets needed:** `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`

### Phase 5: Wire Up Frontend

- Update `ConnectionDialog.tsx`: All 6 platforms support OAuth connect button
- Update `ClientDetail.tsx` `handleManualSync`: Add sync calls for Facebook Pages, Instagram, TikTok, and LinkedIn
- Update `database.ts`: Platform types remain the same (already includes all 6)

### Phase 6: Database

- Add `google_analytics` is NOT in scope (you didn't ask for it)
- No new tables needed — existing `platform_connections`, `monthly_snapshots`, and `sync_logs` tables handle all platforms
- The `platform_type` enum in Postgres already includes all 6 platforms

---

## Summary of API Credentials You Need

| Platform | Portal | Credentials | Status |
|----------|--------|-------------|--------|
| Google Ads | console.cloud.google.com | Client ID + Secret + Dev Token | Already configured |
| Meta/Facebook/Instagram | developers.facebook.com | App ID (hardcoded) + App Secret | Already configured |
| TikTok | business-api.tiktok.com | App ID + App Secret | You need to create an app |
| LinkedIn | linkedin.com/developers | Client ID + Client Secret | You need to create an app |

## Implementation Order

I will build this in order: Phase 1 > Phase 2 > Phase 3 > Phase 4 > Phase 5, pausing at Phase 3 and 4 to ask you to provide the TikTok and LinkedIn API credentials before proceeding.

