

## Plan: Decouple Meta Platforms & Fix TikTok — Independent OAuth Per Integration

### Problem Summary

1. **Facebook & Instagram sync depend on Meta Ads** — Both `sync-facebook-page` and `sync-instagram` look up the `meta_ads` connection for page tokens and IG account IDs. If Meta Ads isn't connected, FB and IG fail with "No connected Meta Ads account found."

2. **No separate connect functions for Facebook or Instagram** — Only `meta-ads-connect` exists. The `CONNECT_FUNCTION_MAP` in `ConnectionDialog.tsx` doesn't include `facebook` or `instagram`, so they can't even start an OAuth flow.

3. **TikTok uses Marketing API only** — The current `tiktok-ads-connect` points to `business-api.tiktok.com/portal/auth` (Marketing API). If the user's TikTok app permissions don't cover the Marketing API, or the token format is wrong, sync fails. DashThis uses `tiktok.com/v2/auth/authorize` with content-level scopes.

### Solution

Make each Meta platform fully independent with its own OAuth flow, token storage, and sync logic — exactly like DashThis does.

---

### Changes

#### 1. Create `facebook-connect` edge function (NEW)
- Separate OAuth flow requesting only Facebook Page scopes: `pages_show_list,pages_read_engagement,read_insights`
- State encodes `platform: "facebook"`
- Returns `auth_url` for the Facebook OAuth dialog

#### 2. Create `instagram-connect` edge function (NEW)
- Separate OAuth flow requesting only Instagram scopes: `pages_show_list,instagram_basic,instagram_manage_insights`
- State encodes `platform: "instagram"`
- Returns `auth_url` for the Facebook OAuth dialog (Instagram uses Facebook OAuth)

#### 3. Update `meta-ads-connect` edge function
- Reduce scopes to ads-only: `ads_read,ads_management,business_management`
- No longer discovers pages or Instagram accounts

#### 4. Add OAuth callback handlers for `facebook` and `instagram` in `oauth-callback/index.ts`
- **`handleFacebook`**: Exchange code → get long-lived token → discover pages with page-level access tokens → store all on the `facebook` connection row (not meta_ads)
- **`handleInstagram`**: Exchange code → get long-lived token → discover pages → extract linked Instagram Business accounts → store on the `instagram` connection row
- **`handleMetaAds`** (update): Stop discovering pages/IG accounts, only discover ad accounts

#### 5. Update `sync-facebook-page` edge function
- Remove dependency on meta_ads connection lookup (lines 63–85)
- Use the `facebook` connection's own `access_token` and `metadata.pages` directly
- Each Facebook connection now stores its own page tokens

#### 6. Update `sync-instagram` edge function
- Remove dependency on meta_ads connection lookup (lines 58–89)
- Use the `instagram` connection's own `access_token` and `metadata.ig_accounts` directly
- Each Instagram connection now stores its own IG account IDs and page tokens

#### 7. Update `tiktok-ads-connect` edge function
- Change OAuth URL from `business-api.tiktok.com/portal/auth` to `www.tiktok.com/v2/auth/authorize/`
- Use `client_key` parameter (not `app_id`)
- Add explicit scopes: `user.info.basic,user.insights,video.list,video.insights`
- Set `response_type=code`

#### 8. Update `ConnectionDialog.tsx`
- Add `facebook` and `instagram` to the `PLATFORMS` array and `OAUTH_SUPPORTED` array
- Add connect function mappings: `facebook: 'facebook-connect'`, `instagram: 'instagram-connect'`

### Files

**New edge functions:**
- `supabase/functions/facebook-connect/index.ts`
- `supabase/functions/instagram-connect/index.ts`

**Modified edge functions:**
- `supabase/functions/oauth-callback/index.ts` — Add `handleFacebook`, `handleInstagram` handlers; update `handleMetaAds` to ads-only
- `supabase/functions/meta-ads-connect/index.ts` — Reduce scopes to ads-only
- `supabase/functions/sync-facebook-page/index.ts` — Use own connection tokens instead of meta_ads
- `supabase/functions/sync-instagram/index.ts` — Use own connection tokens instead of meta_ads
- `supabase/functions/tiktok-ads-connect/index.ts` — Fix OAuth URL and parameters

**Modified frontend:**
- `src/components/clients/ConnectionDialog.tsx` — Add facebook/instagram to platform lists and connect function map

### Technical Details

**Facebook scopes** (separate from Meta Ads):
`pages_show_list,pages_read_engagement,read_insights`

**Instagram scopes** (separate from Meta Ads):
`pages_show_list,instagram_basic,instagram_manage_insights`

**Meta Ads scopes** (ads only):
`ads_read,ads_management,business_management`

**TikTok OAuth URL pattern** (matching DashThis):
`https://www.tiktok.com/v2/auth/authorize/?client_key={APP_ID}&redirect_uri={URI}&response_type=code&scope=user.info.basic,user.insights,video.list,video.insights&state={STATE}`

