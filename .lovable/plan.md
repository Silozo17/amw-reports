
I checked the actual code, live logs, LinkedIn docs, and your screenshot. The issue is not your credentials.

What I found
- OAuth is already working:
  - `oauth-callback` successfully exchanged the auth code
  - it discovered two ad accounts
  - the current connection already has `account_id = 513337793` and `account_name = AMW Media LTD`
- Your screenshot confirms the correct setup is present:
  - redirect URL matches `/functions/v1/oauth-callback`
  - scopes include `r_ads` and `r_ads_reporting`
- The real failure is in the reporting request format:
  - LinkedIn is returning `QUERY_PARAM_NOT_ALLOWED` for:
    - `dateRange.start.day`
    - `dateRange.start.month`
    - `dateRange.start.year`
    - `dateRange.end.day`
    - `dateRange.end.month`
    - `dateRange.end.year`
- The official Reporting docs show `adAnalytics` expects one single Rest.li-style `dateRange` parameter:
```text
dateRange=(start:(year:2024,month:5,day:28),end:(year:2024,month:9,day:30))
```
  not separate nested query params.
- So the bug is in `sync-linkedin-ads` request serialization, not in the Client ID / Primary Client Secret.
- The extra “App ID” is not the blocker here. Since token exchange and account discovery already succeed, I would not add it.

What I will change
1. Fix `buildAnalyticsUrl` in `supabase/functions/sync-linkedin-ads/index.ts`
   - stop building `dateRange` as separate params
   - build the query manually so LinkedIn receives:
```text
q=analytics
pivot=ACCOUNT or CAMPAIGN
dateRange=(start:(year:YYYY,month:M,day:1),end:(year:YYYY,month:M,day:lastDay))
timeGranularity=MONTHLY
accounts=List(urn%3Ali%3AsponsoredAccount%3A...)
fields=...
```
   - keep `fields` raw comma-separated
   - keep `accounts=List(...)` in the format LinkedIn expects

2. Leave OAuth setup unchanged
   - no secret changes
   - no App ID changes
   - no scope changes unless later logs show a real permission error

3. Improve LinkedIn error logging
   - log the exact final analytics URL
   - log the full LinkedIn `errorDetails`
   - make future failures clearly show whether they are formatting, permission, or access-tier issues

4. Re-test only the LinkedIn Ads sync path
   - no changes to organic LinkedIn
   - no database changes
   - no UI changes unless a later failure proves account selection is involved

Files to update
- `supabase/functions/sync-linkedin-ads/index.ts`

Expected outcome
- LinkedIn Ads sync should stop failing on parameter validation
- the existing connected ad account should start producing monthly snapshot data
- if anything still fails after this, it will be a real provider limitation or permission issue, not malformed requests

Technical note
```text
Current broken request:
...&dateRange.start.day=1&dateRange.start.month=5&dateRange.start.year=2024...

Correct LinkedIn request:
...&dateRange=(start:(year:2024,month:5,day:1),end:(year:2024,month:5,day:31))...
```
