
I’m going to stop guessing and rework the LinkedIn Ads sync against the actual LinkedIn reporting contract.

## What I found from the docs

The current `sync-linkedin-ads` function is still requesting unsupported metrics, which is why it keeps failing.

Documented evidence from LinkedIn docs:
- The Analytics Finder docs explicitly list a limited supported `fields` set for `q=analytics`:  
  `externalWebsiteConversions`, `dateRange`, `impressions`, `landingPageClicks`, `likes`, `shares`, `costInLocalCurrency`, `pivotValues`
- The schema docs do list many additional metrics, including `videoViews`, `totalEngagements`, `oneClickLeads`, `qualifiedLeads`, etc.
- But your current runtime failure is specifically because the code requests `leads`, and `leads` is not a valid AdAnalytics field.
- `pivotValues` is correct.
- `accounts=List(...)` is correct.
- `q=analytics` with `pivot=ACCOUNT` / `pivot=CAMPAIGN` is the right general direction, but the chosen field set is wrong.

## Root cause in your code

In `supabase/functions/sync-linkedin-ads/index.ts`:
- `ACCOUNT_FIELDS` currently includes invalid `leads`
- `CAMPAIGN_FIELDS` currently includes invalid `leads`
- The function then calculates:
  - `leads`
  - `cost_per_lead`
- Those are based on a field the endpoint is rejecting

So the fix needs to be broader than “remove one bad field”:
it needs to align the entire sync output with fields that are actually safe to request for this endpoint.

## Implementation plan

### 1) Rebuild the requested metric set from documented-safe fields
Update `sync-linkedin-ads/index.ts` so account and campaign analytics requests use only validated fields:
- `impressions`
- `costInLocalCurrency`
- `externalWebsiteConversions`
- `dateRange`
- `landingPageClicks`
- `likes`
- `shares`
- `pivotValues`

Keep `clicks` too, since LinkedIn returns it by default and examples show it in responses, but do not depend on undocumented extras unless separately verified in the current finder context.

### 2) Remove unsupported lead-based calculations from the sync
Remove:
- `leads`
- `cost_per_lead`

from:
- aggregation logic
- campaign row shape
- `metricsData`
- `topContent`

This is necessary because the current endpoint call cannot reliably provide them.

### 3) Make engagement derive from supported metrics only
Compute engagement from fields we can safely retrieve:
- `clicks`
- `likes`
- `shares`
- optionally `landingPageClicks` if you want a more traffic-oriented engagement proxy

I’d keep the formula simple and explicit in code so it doesn’t imply it is a native LinkedIn metric.

### 4) Keep the request format aligned with LinkedIn REST requirements
Retain the fixes that were correct:
- manual URL construction for `fields`
- `accounts=List(...)`
- `pivotValues` instead of `pivotValue`
- version header `LinkedIn-Version: 202601`

### 5) Make the sync fail fast with clearer provider-specific errors
Improve the error path so if LinkedIn rejects a future field again, the function logs:
- the exact finder used (`analytics`)
- the exact requested field list
- the exact LinkedIn response message

That avoids another guess-and-patch cycle.

### 6) Align frontend metric expectations with actual synced data
Because the app currently advertises LinkedIn Ads metrics including:
- `leads`
- `cost_per_lead`
- `video_views`

I’ll review the LinkedIn Ads metric definitions in `src/types/database.ts` and trim or adjust the default metric list so the UI no longer expects metrics the sync does not populate reliably.

## Files to update

- `supabase/functions/sync-linkedin-ads/index.ts`
- `src/types/database.ts`

## Expected result

After this change:
- LinkedIn Ads sync should stop failing on invalid field projections
- monthly snapshots for `linkedin_ads` will contain only metrics backed by the documented request contract
- the UI won’t advertise unsupported LinkedIn Ads metrics that never arrive

## Technical notes

```text
Current bad request
q=analytics
fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues,videoViews,leads,landingPageClicks,shares,likes
                                                                                                  ^^^^^ invalid in current usage

Safer request set
q=analytics
fields=impressions,costInLocalCurrency,externalWebsiteConversions,dateRange,landingPageClicks,likes,shares,pivotValues
```

```text
Metrics to remove from synced output now:
- leads
- cost_per_lead

Metrics to keep:
- spend
- impressions
- clicks
- ctr
- cpc
- cpm
- conversions
- conversion_rate
- cost_per_conversion
- landing_page_clicks
- engagement
- campaign_count
```

## Risk to be aware of

LinkedIn’s docs are inconsistent between the general schema page and the finder-specific examples. To avoid more breakage, I will treat the finder-specific documented field set as the source of truth for this integration unless we separately validate a broader set in logs/testing.
