

## Auto-Select YouTube Channel When Only One Exists

### Problem
After YouTube OAuth, the user is redirected back to the app with `oauth_pending_selection`, which opens the account picker dialog. But since the user already selected their Google account during OAuth consent, there's typically only one channel — so the picker shows either one option or none, which is confusing and unnecessary.

### Solution
Apply the same pattern used for TikTok: if exactly one YouTube channel is discovered, auto-select it by setting `account_id` and `account_name` directly during the OAuth callback. The account picker only opens if multiple channels exist.

### Changes

**`supabase/functions/oauth-callback/index.ts`** — `handleYouTube` function (lines 769-783):
- After discovering channels, check if exactly one channel was found
- If yes: set `account_id` to the channel ID and `account_name` to the channel title (same as TikTok pattern)
- If multiple: keep current behavior (leave `account_id` null, let picker handle it)

This is a ~10-line change in the edge function. No frontend changes needed — the existing picker already handles the case where `account_id` is already set (it shows "Ready" badge and skips the picker).

