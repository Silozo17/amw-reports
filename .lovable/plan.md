

# Fix LinkedIn Sync — URL-Encode URNs in All API Calls

## Problem
Every LinkedIn sync API call returns 400 errors. The logs show five different endpoints all failing:
- `networkSizes` — "Syntax exception in path variables"
- `organizationalEntityFollowerStatistics` — "Invalid query parameters"
- `organizationalEntityShareStatistics` — "Invalid query parameters"
- `organizationPageStatistics` — "Invalid query parameters"
- `posts` finder — "Invalid query parameters"

## Root Cause
The LinkedIn REST API docs explicitly state: **"URNs included in the URL params must be URL encoded."** For example, `urn:li:organization:12345` must become `urn%3Ali%3Aorganization%3A12345`.

The current `sync-linkedin/index.ts` passes all URNs raw (unencoded) in both path segments and query parameters.

Additionally, the `timeIntervals` parameter uses RestLI 2.0 parenthetical syntax, which is fragile. The docs also show a simpler RestLI 1.0 dot-notation format that avoids encoding issues.

## Fix (single file: `supabase/functions/sync-linkedin/index.ts`)

Five functions need URN encoding:

**1. `getFollowerCount` (line 31)** — URL-encode the URN in the path:
```
/rest/networkSizes/${encodeURIComponent(`urn:li:organization:${orgId}`)}?edgeType=CompanyFollowedByMember
```
Also switch `edgeType` to camelCase `CompanyFollowedByMember` as shown in the docs' alternative format.

**2. `getFollowerGains` (lines 48-49)** — Switch to dot-notation and encode URN:
```
organizationalEntity=${encodeURIComponent(`urn:li:organization:${orgId}`)}
&timeIntervals.timeGranularityType=MONTH
&timeIntervals.timeRange.start=${startMs}
&timeIntervals.timeRange.end=${endMs}
```

**3. `getShareStatistics` (lines 78-79)** — Same dot-notation + encoded URN pattern.

**4. `getPageStatistics` (lines 107-108)** — Same dot-notation + encoded URN for the `organization` param.

**5. `getTopContent` (line 145)** — Encode the `author` URN:
```
author=${encodeURIComponent(`urn:li:organization:${orgId}`)}&q=author&count=100&sortBy=LAST_MODIFIED
```
Also change `sortBy=CREATED` to `sortBy=LAST_MODIFIED` (the default per docs).

**6. Per-post stats URL (line 168)** — Encode the `organizationalEntity` URN and any post URNs in the `ugcPosts` list.

After changes, deploy the `sync-linkedin` edge function.

## No other files change
The fix is entirely within `supabase/functions/sync-linkedin/index.ts`. After deployment, trigger a re-sync on a LinkedIn-connected client to verify metrics flow in.

