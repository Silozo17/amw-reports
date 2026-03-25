

## Fix Plan: Three Issues

### Issue 1: YouTube still shows empty picker after OAuth
**Root cause**: The redirect in `oauth-callback/index.ts` (line 92) **always** sends `oauth_pending_selection=${connectionId}` regardless of whether auto-selection already happened. The client-side guard works, but the flow is fragile — it re-fetches the connection and checks. The real fix is to skip `oauth_pending_selection` entirely when `account_id` is already set.

**Change in `supabase/functions/oauth-callback/index.ts`** (lines 81-95):
- After calling the platform handler, re-fetch the connection to check if `account_id` was set (auto-selected).
- If `account_id` is present, redirect with `?oauth_connected=1` (success, no picker needed).
- If `account_id` is null and `last_error` is set, redirect with `?oauth_error=...`.
- Only use `oauth_pending_selection` when `account_id` is null and there are multiple assets to choose from.

**Change in `src/pages/clients/ClientDetail.tsx`**:
- Handle the new `oauth_connected` param with a success toast and data refresh.

### Issue 2: Google Analytics and Google Business Profile also fail (SERVICE_DISABLED)
**Change in `supabase/functions/oauth-callback/index.ts`**:
- Apply the same `discoveryError` pattern from YouTube to `handleGoogleAnalytics` and `handleGoogleBusinessProfile`.
- When the API returns a 403/SERVICE_DISABLED, store `discovery_error` in metadata and set `is_connected: false` with a descriptive `last_error`.

### Issue 3: Connection dialog shows all existing connections — should only show "Add new"
**Change in `src/components/clients/ConnectionDialog.tsx`**:
- Remove the entire existing-connections list block (lines 130-195) that renders all current connections with Select/Change/Connect buttons and badges.
- Change the dialog title to "Add Connection".
- Filter the platform dropdown to exclude platforms that already have a connection for this client.
- The dialog becomes a simple "pick platform + connect" form.

### Files to modify
1. `supabase/functions/oauth-callback/index.ts` — smarter redirect logic + GA/GBP error handling
2. `src/pages/clients/ClientDetail.tsx` — handle `oauth_connected` param
3. `src/components/clients/ConnectionDialog.tsx` — remove existing connections list, filter already-connected platforms

