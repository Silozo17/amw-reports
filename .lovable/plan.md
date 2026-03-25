
Goal: fix the YouTube connection flow so users do not see an empty “Select account” modal after OAuth.

What I found:
- The YouTube connection record is being saved as connected, but with `account_id = null`, `account_name = null`, and `metadata.channels = []`.
- The OAuth callback is still redirecting with `oauth_pending_selection=...`, which forces the app to open the account picker.
- The actual backend log shows the real cause: the Google project behind the current production credentials has YouTube Data API v3 disabled, so channel discovery fails with a 403.
- This means the issue is not that Google already selected the account; it is that the app cannot fetch the YouTube channel list after OAuth.

Implementation plan:
1. Harden the YouTube OAuth callback
- Update `supabase/functions/oauth-callback/index.ts` so YouTube channel discovery treats Google API errors explicitly instead of silently falling back to an empty list.
- Store a friendly `last_error` / metadata error when discovery fails (especially for `SERVICE_DISABLED` / 403 cases).
- Only set `oauth_pending_selection` when there are actually multiple selectable channels.
- If exactly one channel exists, keep the current auto-select behavior.
- If discovery fails or no channels are available, do not send the user into the picker flow.

2. Improve the client-side redirect handling
- Update `src/pages/clients/ClientDetail.tsx` so the page only opens `AccountPickerDialog` when the fetched connection has real selectable assets in its metadata.
- If the connection has no assets and has a YouTube discovery error, show the real error as a toast or inline status instead of opening the empty modal.

3. Improve connection status messaging
- Keep the connection row from looking like a generic “Select Account” state when YouTube discovery failed.
- Show a clearer status based on `last_error` such as “Additional YouTube API setup required” or the exact backend error message.
- This avoids misleading users into thinking they missed a step in the Google chooser.

4. Preserve the intended UX
- If one YouTube channel is discovered: auto-connect it.
- If multiple channels are discovered: open the picker.
- If zero channels are discovered because of a backend/API issue: show an actionable error, not a picker.

Technical details:
- Files to update:
  - `supabase/functions/oauth-callback/index.ts`
  - `src/pages/clients/ClientDetail.tsx`
- No database migration is needed.
- Root cause from logs: the production Google app needs YouTube Data API v3 enabled. OAuth consent alone is not enough because the app uses the YouTube Data API to discover the channel after sign-in.
- The sync flow also depends on YouTube Data API for channel stats and video titles, so enabling that API is required beyond just the initial connection flow.

Expected outcome:
- Users will no longer see an empty YouTube account picker.
- Real YouTube setup problems will be surfaced clearly.
- The flow will behave correctly for all three cases: one channel, many channels, or discovery failure.
