

# Fix Token Auto-Refresh to Prevent Connection Expirations

## Root Cause

Four platform sync functions store tokens with expiry dates but **never refresh them** when they expire. The `check-expiring-tokens` cron then fires off disconnection emails for every expired token.

| Platform | Has refresh_token? | Auto-refreshes? | Token lifetime |
|---|---|---|---|
| Google Ads, GSC, GA4, GBP, YouTube | Yes | **Yes** ✅ | ~1 hour (refreshed) |
| Pinterest | Yes | **Yes** ✅ | ~1 hour (refreshed) |
| Meta Ads | No (long-lived) | **No** ❌ | ~60 days |
| Facebook Pages | No (page tokens are permanent) | **No** ❌ | ~60 days (user token) |
| Instagram | No (uses page tokens) | **No** ❌ | ~60 days (user token) |
| TikTok | Yes | **No** ❌ | ~24 hours |
| LinkedIn | Yes | **No** ❌ | ~60 days |

## The Fix — Two Parts

### Part 1: Add token refresh to sync functions that lack it

**TikTok** (`supabase/functions/sync-tiktok-ads/index.ts`):
- Before syncing, check `token_expires_at`. If expired, call TikTok's refresh endpoint (`POST https://open.tiktokapis.com/v2/oauth/token/` with `grant_type=refresh_token`)
- Update `access_token`, `refresh_token`, and `token_expires_at` in the DB
- Use the new token for the sync

**LinkedIn** (`supabase/functions/sync-linkedin/index.ts`):
- Before syncing, check `token_expires_at`. If expired, call LinkedIn's refresh endpoint (`POST https://www.linkedin.com/oauth/v2/accessToken` with `grant_type=refresh_token`)
- Update `access_token` and `token_expires_at` in the DB

**Meta platforms** (Facebook, Instagram, Meta Ads) — these use long-lived tokens that can't be traditionally refreshed with a refresh_token. Instead:
- **Facebook Pages**: Page-level access tokens obtained via `me/accounts` are **permanent** and never expire. The issue is the *user* token expiry is stored as `token_expires_at` even though page tokens in metadata don't expire. Fix: After obtaining page tokens during OAuth, set `token_expires_at` to `null` since the actual page tokens used for syncing don't expire.
- **Instagram**: Same as Facebook — uses page tokens from metadata which are permanent. Set `token_expires_at` to `null`.
- **Meta Ads**: Long-lived user tokens (~60 days) with no refresh mechanism. Add proactive re-exchange: before expiry, call `fb_exchange_token` again to get a fresh 60-day token.

### Part 2: Fix the notification system to not alert on auto-refreshable tokens

**`supabase/functions/check-expiring-tokens/index.ts`**:
- For Google/Pinterest/TikTok/LinkedIn connections that have a `refresh_token`, **skip** the expiring/expired notification — these will auto-refresh on next sync
- For Meta platforms with page-level tokens (Facebook, Instagram), skip notifications — page tokens don't expire
- Only send expiring/expired notifications for connections that genuinely cannot auto-refresh (Meta Ads user tokens approaching 60-day expiry with no refresh mechanism)

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/sync-tiktok-ads/index.ts` | Add token refresh before sync using TikTok refresh_token |
| `supabase/functions/sync-linkedin/index.ts` | Add token refresh before sync using LinkedIn refresh_token |
| `supabase/functions/sync-meta-ads/index.ts` | Add proactive long-lived token re-exchange before expiry |
| `supabase/functions/sync-facebook-page/index.ts` | Remove expired token check — page tokens don't expire |
| `supabase/functions/sync-instagram/index.ts` | Remove expired token check — page tokens don't expire |
| `supabase/functions/oauth-callback/index.ts` | For Facebook/Instagram: set `token_expires_at` to null (page tokens are permanent) |
| `supabase/functions/check-expiring-tokens/index.ts` | Skip notifications for connections with refresh_tokens or permanent page tokens |

## Implementation Order

1. **Batch 1**: TikTok + LinkedIn refresh logic (both straightforward refresh_token flows)
2. **Batch 2**: Meta platform fixes (Facebook/Instagram token_expires_at → null, Meta Ads re-exchange)
3. **Batch 3**: Update check-expiring-tokens to only alert on genuinely un-refreshable tokens

