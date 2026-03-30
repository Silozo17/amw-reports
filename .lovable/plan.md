

# Add TikTok Ads Integration (Business API)

## Overview

Add TikTok Ads as a new platform type (`tiktok_ads`) alongside the existing organic TikTok integration (`tiktok`). This uses the TikTok Marketing/Business API v1.3, which is entirely separate from the Login Kit used for organic content.

**Key difference**: TikTok Business API tokens are **long-lived** (no expiry), auth uses `app_id` + `secret` + `auth_code` exchange, and data comes from the Reporting API (`/report/integrated/get/`).

---

## New Secrets Required

Two new secrets (separate from existing `TIKTOK_APP_ID`/`TIKTOK_APP_SECRET`):

- `TIKTOK_BUSINESS_APP_ID` — App ID from your TikTok Marketing API developer app
- `TIKTOK_BUSINESS_APP_SECRET` — Secret from your TikTok Marketing API developer app

---

## Implementation Plan

### 1. Add secrets
Use the `add_secret` tool for `TIKTOK_BUSINESS_APP_ID` and `TIKTOK_BUSINESS_APP_SECRET`.

### 2. Update `PlatformType` and mappings in `src/types/database.ts`
- Add `'tiktok_ads'` to the `PlatformType` union
- Add `tiktok_ads` entry to `PLATFORM_LABELS` → `'TikTok Ads'`
- Add `tiktok_ads` entry to `PLATFORM_LOGOS` → reuse `tiktokLogo`
- Remove `tiktok` from `ORGANIC_PLATFORMS` set (it's already there, `tiktok_ads` should NOT be added since it's a paid platform)
- Add `tiktok_ads` to `PLATFORM_AVAILABLE_METRICS` with ad-specific metrics:
  `['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions', 'conversions_value', 'reach', 'video_views', 'conversion_rate']`

### 3. Update platform lists in frontend components
- `ConnectionDialog.tsx` — add `'tiktok_ads'` to `PLATFORMS`, `OAUTH_SUPPORTED`, and `CONNECT_FUNCTION_MAP` (`tiktok_ads: 'tiktok-business-connect'`)
- `src/lib/triggerSync.ts` — add `tiktok_ads: 'sync-tiktok-business'` to `SYNC_FUNCTION_MAP`
- `MetricsDefaultsSection.tsx` — add `'tiktok_ads'` to `ALL_PLATFORMS`
- `IntegrationsPage.tsx` — already lists TikTok Ads in the marketing copy (no change needed)

### 4. Create `tiktok-business-connect` edge function
OAuth connect function using TikTok Business API authorization:
- Uses `TIKTOK_BUSINESS_APP_ID` and `TIKTOK_BUSINESS_APP_SECRET`
- Builds authorization URL: `https://business-api.tiktok.com/portal/auth/` with `app_id`, `redirect_uri`, and `state`
- State includes `platform: "tiktok_ads"` to distinguish from organic in the callback
- Redirect URI points to the existing `oauth-callback` function

### 5. Update `oauth-callback` to handle `tiktok_ads` platform
Add a new `handleTikTokAds` function:
- Token exchange via `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/` with `{app_id, secret, auth_code}`
- Returns a **long-lived token** (no expiry) and `advertiser_ids[]`
- Discover advertiser accounts via `GET /open_api/v1.3/oauth2/advertiser/get/` with `Access-Token` header
- Store accounts in `metadata.ad_accounts` for the account picker
- Token does not expire → set `token_expires_at = null`

### 6. Create `sync-tiktok-business` edge function
Sync function for TikTok Ads reporting data:
- Uses TikTok Reporting API: `GET /open_api/v1.3/report/integrated/get/`
- Query at `AUCTION_ADVERTISER` level with `advertiser_id` from `account_id`
- Metrics requested: `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `conversion`, `complete_payment_roas`, `reach`, `video_play_actions`, `total_complete_payment_rate`
- Date range: first day to last day of the requested month/year
- Maps API response fields to our standard metric names (spend, impressions, clicks, etc.)
- Upserts into `monthly_snapshots` with platform `'tiktok_ads'`
- Standard sync log, connection status, and org membership verification (following the pattern from `sync-meta-ads`)

### 7. Update `scheduled-sync` and `check-expiring-tokens`
- `scheduled-sync` already iterates all connections — no change needed since it uses `SYNC_FUNCTION_MAP` pattern via platform lookup
- `check-expiring-tokens` — add logic to skip `tiktok_ads` connections since Business API tokens are long-lived (no expiry)

---

## Technical Details

**TikTok Business API Auth Flow:**
```text
1. User clicks "Add Connection" → selects TikTok Ads
2. Frontend calls tiktok-business-connect edge function
3. Edge function builds auth URL → redirects user to TikTok
4. Advertiser authorizes → TikTok redirects to oauth-callback with auth_code
5. oauth-callback exchanges auth_code for long-lived access_token
6. Discovers advertiser accounts → stores in metadata
7. Account picker shows if multiple accounts found
```

**TikTok Reporting API Request:**
```json
{
  "advertiser_id": "<from account_id>",
  "report_type": "BASIC",
  "data_level": "AUCTION_ADVERTISER",
  "dimensions": ["advertiser_id"],
  "metrics": ["spend", "impressions", "clicks", "ctr", "cpc", "cpm",
              "conversion", "complete_payment_roas", "reach",
              "video_play_actions", "total_complete_payment_rate"],
  "start_date": "2026-03-01",
  "end_date": "2026-03-31"
}
```

**Files to create:**
- `supabase/functions/tiktok-business-connect/index.ts`
- `supabase/functions/sync-tiktok-business/index.ts`

**Files to modify:**
- `src/types/database.ts` — add `tiktok_ads` to types, labels, logos, metrics
- `src/components/clients/ConnectionDialog.tsx` — add `tiktok_ads` to platform lists
- `src/lib/triggerSync.ts` — add sync function mapping
- `src/components/settings/MetricsDefaultsSection.tsx` — add to ALL_PLATFORMS
- `supabase/functions/oauth-callback/index.ts` — add `tiktok_ads` handler
- `supabase/functions/check-expiring-tokens/index.ts` — skip tiktok_ads (long-lived tokens)

