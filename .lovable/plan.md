

# Pinterest Integration

## Overview
Add Pinterest as a new platform following the exact patterns used by existing integrations (TikTok, LinkedIn, etc.). This covers the full pipeline: OAuth connect, callback token exchange, account discovery, sync function, and dashboard display.

## Prerequisites
- Store `PINTEREST_APP_ID` (value: `1556588`) as a constant in the connect function (same pattern as Meta's `appId`)
- Store `PINTEREST_APP_SECRET` as an edge function secret via the `add_secret` tool
- Pinterest OAuth endpoints: authorize at `https://www.pinterest.com/oauth/`, token at `https://api.pinterest.com/v5/oauth/token`
- Redirect URI to register in Pinterest: `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
- Scopes: `pins:read,boards:read,user_accounts:read`

## Database Changes

**1. Alter `platform_type` enum** — add `'pinterest'` value

**2. Add `metric_defaults` row for pinterest** — insert default metrics

## Files to Create

### 1. `supabase/functions/pinterest-connect/index.ts`
OAuth initiation function (same pattern as `instagram-connect`):
- Accepts `connection_id` and `redirect_url`
- Builds Pinterest OAuth URL: `https://www.pinterest.com/oauth/?client_id=1556588&redirect_uri=...&response_type=code&scope=pins:read,boards:read,user_accounts:read&state=...`
- State encodes `connection_id`, `platform: "pinterest"`, and `redirect_url`

### 2. `supabase/functions/sync-pinterest/index.ts`
Sync function that fetches organic Pinterest analytics for a given month/year:
- Uses `GET https://api.pinterest.com/v5/user_account/analytics` with `start_date`, `end_date`, and metric columns: `IMPRESSION`, `SAVE`, `PIN_CLICK`, `OUTBOUND_CLICK`, `ENGAGEMENT`, `ENGAGEMENT_RATE`
- Uses `GET https://api.pinterest.com/v5/user_account` for follower count
- Uses `GET https://api.pinterest.com/v5/boards` + `GET https://api.pinterest.com/v5/boards/{board_id}/pins` for board-level data
- Stores top boards as `top_content` in the snapshot (same pattern as top_queries, top_videos)
- Metrics stored: `impressions`, `saves`, `pin_clicks`, `outbound_clicks`, `engagement`, `engagement_rate`, `total_followers`, `total_pins`, `total_boards`
- Handles token refresh via Pinterest's refresh token endpoint if token is expired

## Files to Modify

### 3. `supabase/functions/oauth-callback/index.ts`
Add `handlePinterest` function:
- Exchange code for tokens via `POST https://api.pinterest.com/v5/oauth/token` (Basic auth with `app_id:app_secret`)
- Fetch user account via `GET https://api.pinterest.com/v5/user_account` to get username
- Auto-select (single user account, same as TikTok pattern)
- Store `access_token`, `refresh_token`, `token_expires_at`, `account_id` (username), `account_name`

Add `else if (platform === "pinterest")` branch in the main handler (after youtube).

### 4. `src/types/database.ts`
- Add `'pinterest'` to `PlatformType` union
- Add `pinterest: 'Pinterest'` to `PLATFORM_LABELS`
- Import and add Pinterest logo to `PLATFORM_LOGOS`
- Add `pinterest` to `ORGANIC_PLATFORMS` set
- Add Pinterest metric labels: `pin_clicks`, `outbound_clicks`, `saves`, `total_pins`, `total_boards`, `top_boards`
- Add `pinterest` entry to `PLATFORM_AVAILABLE_METRICS`

### 5. `src/types/metrics.ts`
- Add Pinterest metric explanations to `METRIC_EXPLANATIONS`

### 6. `src/components/clients/ConnectionDialog.tsx`
- Add `'pinterest'` to `PLATFORMS` array
- Add `'pinterest'` to `OAUTH_SUPPORTED` array
- Add `pinterest: 'pinterest-connect'` to `CONNECT_FUNCTION_MAP`

### 7. `src/lib/triggerSync.ts`
- Add `pinterest: 'sync-pinterest'` to `SYNC_FUNCTION_MAP`

### 8. `supabase/functions/scheduled-sync/index.ts`
- Add `pinterest: 'sync-pinterest'` to `SYNC_FUNCTION_MAP`

### 9. Copy Pinterest logo
- Copy uploaded `Pinterest-Logo.webp` to `src/assets/logos/pinterest.webp`

## Pinterest API Details

**Token exchange** uses HTTP Basic Auth (`Authorization: Basic base64(app_id:app_secret)`), unlike other platforms.

**Analytics endpoint**: `GET /v5/user_account/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&metric_types=ORGANIC&columns=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`

**Board analytics**: `GET /v5/boards` lists all boards with pin counts; individual board pins can be fetched for top-performing board breakdown.

**Token refresh**: `POST /v5/oauth/token` with `grant_type=refresh_token` and Basic auth header.

## Metrics Summary

| Metric Key | Label | Source |
|---|---|---|
| impressions | Impressions | user_account/analytics |
| saves | Saves | user_account/analytics |
| pin_clicks | Pin Clicks | user_account/analytics |
| outbound_clicks | Outbound Clicks | user_account/analytics |
| engagement | Engagement | user_account/analytics |
| engagement_rate | Engagement Rate | user_account/analytics |
| total_followers | Total Followers | user_account |
| total_pins | Total Pins | user_account |
| total_boards | Total Boards | boards count |
| top_boards | Top Boards | boards list |

## Order of Implementation
1. Add secret (`PINTEREST_APP_SECRET`)
2. DB migration (enum + metric defaults)
3. Copy logo asset
4. Create `pinterest-connect` edge function
5. Add `handlePinterest` to `oauth-callback`
6. Create `sync-pinterest` edge function
7. Update frontend types, connection dialog, sync maps

