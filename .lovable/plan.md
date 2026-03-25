
Issue found:

- The TikTok integration is currently mixing two different TikTok products:
  - the backend OAuth + sync code is built for TikTok Login Kit / Content API (organic account analytics)
  - the UI and account-picker still treat TikTok like an advertiser/ads integration
- Your screenshot is from the TikTok Business/Advertiser app settings page. That flow uses `app_id`, while the current OAuth URL in code uses a Login Kit `client_key`. That mismatch is the most likely reason TikTok is throwing the `client_key` error.
- There is also a second bug in the app: the OAuth callback stores TikTok accounts in `metadata.accounts`, but the picker reads `metadata.advertisers`. So even if OAuth succeeded, TikTok would still get stuck as not fully connected.

Plan:

1. Align TikTok to the organic metrics flow
   - Keep the Login Kit + Content API approach, because it matches the metrics you asked for: reach/views, likes, comments, shares, followers, profile views, watch time, completion rate.
   - Update the TikTok connect function to clearly use Login Kit credentials and add better validation/error messages around missing or invalid TikTok credentials.

2. Remove advertiser-specific TikTok assumptions in the app
   - Replace TikTok “ads/advertiser” wording with “TikTok account”.
   - Update the TikTok account picker to read the same metadata shape the callback actually saves.
   - If TikTok only returns one connected account, auto-select it so the connection becomes usable immediately.

3. Make OAuth completion consistent
   - Save `account_id` and `account_name` during the TikTok callback instead of leaving them null.
   - Ensure TikTok OAuth errors route back to the correct client page with a clearer error state.

4. Keep the enhanced TikTok sync logic
   - Preserve the extra fields already added in sync:
     - profile views
     - bio link clicks
     - average time watched
     - completion rate
     - per-video reach / likes / comments / shares

5. Validate the TikTok app setup against the code
   - Keep the callback URL exactly as:
     `https://kcdixfmjiifpnbtplodv.supabase.co/functions/v1/oauth-callback`
   - Verify the app is configured for TikTok Login Kit / Open Platform, not only the Business advertiser flow shown in the screenshot.
   - If the app is unreleased, account for TikTok’s unreleased-app approval requirement, since that can also surface as a misleading `client_key` error.

Technical details:

- `supabase/functions/tiktok-ads-connect/index.ts`
  - tighten credential handling for Login Kit auth
  - improve failure messages for invalid TikTok setup
- `supabase/functions/oauth-callback/index.ts`
  - store TikTok account selection in a consistent shape
  - set `account_id` / `account_name` on success
- `src/components/clients/AccountPickerDialog.tsx`
  - stop expecting `metadata.advertisers` for TikTok
- `src/components/clients/ConnectionDialog.tsx`
  - remove advertiser-specific TikTok naming
- `src/pages/clients/ClientDetail.tsx`
  - improve OAuth error return handling

Important design note:

- If you want TikTok Ads reporting later, it should be implemented as a separate TikTok Ads connection instead of being mixed into this organic TikTok connection.
