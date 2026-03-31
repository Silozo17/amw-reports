
Goal: reset the TikTok implementation so Organic TikTok and TikTok Ads are treated as two fully separate integrations with zero ambiguous naming, and fix the exact reason Black Steel Doors shows no TikTok data.

What I verified in the current code:
- Organic TikTok connection currently uses `tiktok` and the Login Kit credentials:
  - `src/components/clients/ConnectionDialog.tsx` maps `tiktok -> tiktok-ads-connect`
  - `supabase/functions/tiktok-ads-connect/index.ts` actually uses `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET`
  - `oauth-callback` routes `tiktok -> handleTikTok()`
  - `handleTikTok()` uses `open.tiktokapis.com` and stores `account_id = open_id`
- TikTok Ads connection currently uses `tiktok_ads` and Business API credentials:
  - `src/components/clients/ConnectionDialog.tsx` maps `tiktok_ads -> tiktok-business-connect`
  - `supabase/functions/tiktok-business-connect/index.ts` uses `TIKTOK_BUSINESS_APP_ID` / `TIKTOK_BUSINESS_APP_SECRET`
  - `oauth-callback` routes `tiktok_ads -> handleTikTokAds()`
  - `handleTikTokAds()` uses `business-api.tiktok.com` and stores advertiser accounts
- Sync routing is currently separated correctly:
  - `tiktok -> sync-tiktok-business`
  - `tiktok_ads -> sync-tiktok-ads`

Actual root cause for Black Steel Doors having no TikTok data:
- `supabase/functions/sync-tiktok-business/index.ts` is throwing on successful TikTok Organic responses.
- Current code does:
  - `if (data.error?.code) throw ...`
- Your logs prove TikTok Organic returns:
  - `error.code = "ok"`
- So every successful organic response is being treated as a failure.
- That is why Black Steel Doors connected successfully, got `open_id`, but produced no snapshot data.

What I will change:
1. Introduce explicit naming constants for platform routing
- Add a shared platform-routing module for:
  - platform keys
  - connect function names
  - sync function names
- Keep database platform values as:
  - `tiktok` = TikTok Organic
  - `tiktok_ads` = TikTok Ads
- But rename code-facing function constants so they are impossible to confuse.

2. Rename edge functions in code usage to match purpose clearly
- Organic:
  - connect function should be referenced as TikTok Organic connect
  - sync function should be referenced as TikTok Organic sync
- Ads:
  - connect function should be referenced as TikTok Ads connect
  - sync function should be referenced as TikTok Ads sync
- If we keep existing deployed function filenames for compatibility, I’ll still centralize aliases so the app code never uses misleading names directly again.

3. Fix TikTok Organic sync error handling
- In `sync-tiktok-business/index.ts`, only treat TikTok response as an error when:
  - `error.code` exists and is not `"ok"`
- This is the direct blocker for Black Steel Doors.

4. Audit and standardize Organic-only behavior
- Ensure Organic TikTok uses only:
  - `TIKTOK_APP_ID`
  - `TIKTOK_APP_SECRET`
  - `open.tiktokapis.com`
  - organic metrics/content storage
- Confirm it stores videos/top content under platform `tiktok`
- Confirm dashboard rendering continues to treat it like Facebook/Instagram organic content

5. Audit and standardize Ads-only behavior
- Ensure TikTok Ads uses only:
  - `TIKTOK_BUSINESS_APP_ID`
  - `TIKTOK_BUSINESS_APP_SECRET`
  - `business-api.tiktok.com`
  - ad metrics/top ads storage
- Confirm it stores snapshots under platform `tiktok_ads`

6. Remove ambiguous frontend routing names
- Update `ConnectionDialog.tsx` so the mapping source of truth reads clearly as:
  - TikTok Organic connect
  - TikTok Ads connect
- Update `triggerSync.ts` and `scheduled-sync/index.ts` to use the same centralized routing constants rather than repeated handwritten maps.

7. Verify all UI labels remain explicit
- Keep labels as:
  - `tiktok` => `TikTok`
  - `tiktok_ads` => `TikTok Ads`
- Re-check admin sync dialog and any picker/help text so nothing says “TikTok Ads” for an organic connection.

Files involved:
- `src/components/clients/ConnectionDialog.tsx`
- `src/lib/triggerSync.ts`
- `supabase/functions/scheduled-sync/index.ts`
- `supabase/functions/sync-tiktok-business/index.ts`
- `supabase/functions/sync-tiktok-ads/index.ts`
- `supabase/functions/tiktok-ads-connect/index.ts`
- `supabase/functions/tiktok-business-connect/index.ts`
- `supabase/functions/oauth-callback/index.ts`
- likely one new shared mapping file, e.g. `src/lib/platformRouting.ts`

Technical notes:
- No database migration is needed.
- The OAuth connection for Black Steel Doors appears valid already:
  - token exchange succeeded
  - user info returned successfully
  - `open_id` was received
- The failure is in Organic sync response handling, not in secrets or OAuth setup.
- Main safety improvement is to stop relying on misleading function filenames spread across multiple files.

Implementation outcome:
- TikTok Organic = separate, explicit, organic-only path
- TikTok Ads = separate, explicit, ads-only path
- Black Steel Doors organic TikTok data should start syncing once the Organic sync success handling is fixed and the connection is re-synced
