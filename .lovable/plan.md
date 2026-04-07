

# Fix LinkedIn Ads API Sync Errors

## Root Cause

Two issues in `supabase/functions/sync-linkedin-ads/index.ts`:

1. **URL encoding of `fields` parameter**: `searchParams.set("fields", "impressions,clicks,...")` URL-encodes commas to `%2C`, so LinkedIn receives the entire string as a single field name instead of separate fields. The error message in the screenshot confirms this: `"Projected field "impressions%2Cclicks%2CcostInLocalCurrency%2C..."`.

2. **`accounts` parameter format**: LinkedIn REST API expects `accounts=List(urn:li:sponsoredAccount:123)` but we're passing it without the `List()` wrapper.

3. **Invalid field names**: Some fields (`videoCompletions`, `oneClickLeads`, `totalEngagements`) may not exist in the `AdAnalyticsV8` schema for the v202601 API version.

## Fix

### File: `supabase/functions/sync-linkedin-ads/index.ts`

**Change 1 — Account-level analytics URL (line ~134-146)**: Build the URL string manually instead of using `searchParams.set` for `fields` and `accounts`, so commas and special chars are not encoded. Use only fields confirmed in the LinkedIn docs. Use `List()` wrapper for the accounts parameter.

Replace:
```ts
const analyticsUrl = new URL("https://api.linkedin.com/rest/adAnalytics");
analyticsUrl.searchParams.set("q", "analytics");
// ... all the searchParams.set calls ...
analyticsUrl.searchParams.set("fields", "impressions,clicks,...");
```

With manually constructed URL:
```ts
const analyticsParams = new URLSearchParams();
analyticsParams.set("q", "analytics");
analyticsParams.set("pivot", "ACCOUNT");
analyticsParams.set("dateRange.start.day", "1");
analyticsParams.set("dateRange.start.month", String(month));
analyticsParams.set("dateRange.start.year", String(year));
analyticsParams.set("dateRange.end.day", String(lastDay));
analyticsParams.set("dateRange.end.month", String(month));
analyticsParams.set("dateRange.end.year", String(year));
analyticsParams.set("timeGranularity", "MONTHLY");

const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${adAccountId}`);
const accountFields = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValue,videoViews,leads,landingPageClicks,shares,likes";

const analyticsUrlStr = `https://api.linkedin.com/rest/adAnalytics?${analyticsParams.toString()}&accounts=List(${accountUrn})&fields=${accountFields}`;
```

This keeps `fields` and `accounts` unencoded while letting `URLSearchParams` handle the rest.

**Change 2 — Campaign-level analytics URL (line ~188-201)**: Same pattern — manually append `fields` and `accounts` to avoid comma encoding. Use only valid fields.

**Change 3 — Remove references to invalid fields** in the aggregation logic (lines ~168-179): Remove `videoCompletions`, `oneClickLeads`, `totalEngagements` from the aggregation since they're not in the API schema. Adjust `metricsData` output accordingly — use `likes + shares` for engagement instead.

### Summary of field changes

Remove from requests: `videoCompletions`, `externalWebsitePostClickConversions`, `externalWebsitePostViewConversions`, `oneClickLeads`, `totalEngagements`

Keep (confirmed in docs): `impressions`, `clicks`, `costInLocalCurrency`, `externalWebsiteConversions`, `dateRange`, `pivotValue`, `videoViews`, `leads`, `landingPageClicks`, `likes`, `shares`

