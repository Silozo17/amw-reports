
The user wants to add the `ads_read` scope to the Facebook page connection so the `is_from_ads` breakdown returns paid data (not silent zeros), enabling proper organic vs. paid view separation.

## Current state
- `supabase/functions/facebook-connect/index.ts` requests scope: `pages_show_list,pages_read_engagement,read_insights`
- Missing: `ads_read` (and arguably `ads_management` for completeness, but `ads_read` is sufficient for insights breakdowns)
- The Meta App ID is already configured; no Meta dashboard work needed by us — but the user must reconnect the Facebook page after the change so Meta re-issues a token with the new scope.

## The plan

**1. Add `ads_read` to the Facebook OAuth scope**
- File: `supabase/functions/facebook-connect/index.ts`
- Change scope string from:
  `pages_show_list,pages_read_engagement,read_insights`
  to:
  `pages_show_list,pages_read_engagement,read_insights,ads_read`

**2. Redeploy `facebook-connect` edge function** (automatic on save).

**3. User action required (I'll guide them in chat):**
- Go to AMW Media client → Connections → Facebook Page
- Click "Disconnect"
- Click "Connect" again → Meta will show a permission screen now including "Access ads-related stats" — they must approve it
- After reconnect, trigger a fresh April 2026 resync
- I'll then verify `page_media_view` with `is_from_ads=1` returns a non-zero paid number, confirming the breakdown finally works

**4. Once confirmed working** (separate follow-up, not in this plan):
- Decide whether to switch the dashboard formula to `page_media_view` (total) − `is_from_ads=1` portion = true organic views.

## Scope of this plan
- **In scope:** Single one-line scope change to `facebook-connect/index.ts` + reconnect guidance.
- **Out of scope:** Changing the sync formula or dashboard metric — we do that only after we confirm the new scope actually returns paid breakdown data.

## Risk flag
Adding `ads_read` means Meta will show users a more sensitive permission screen on connect. For AMW Media's own page this is fine, but for future client connections, end-clients may hesitate. Acceptable trade-off since it's the only way to separate organic from paid views accurately.
