

# Fix LinkedIn Organic Sync — Complete Rewrite Using Correct APIs

## Problems Found

1. **API version `202503` is sunset.** LinkedIn docs confirm it. The latest supported version is `202603`.
2. **Uses deprecated `ugcPosts` API** — LinkedIn replaced it with the `posts` API. The `ugcPosts` endpoint may stop working or return incomplete data.
3. **Follower count method is wrong.** The docs explicitly say: *"This endpoint no longer returns totalFollowerCounts. Use the networkSizes API."* Current code tries to sum `organicFollowerCount + paidFollowerCount` from `organizationalEntityFollowerStatistics`, which returns demographic breakdowns, not totals.
4. **N+1 per-post stats fetching.** Current code fetches all posts, filters by date, then makes a separate API call for each post's stats. The `organizationalEntityShareStatistics` API already supports time-bound aggregate stats in a single call — no need to enumerate posts for totals.
5. **Missing metrics.** The sync doesn't capture: page views (desktop/mobile), unique impressions, follower gains for the month, or engagement rate (already computed by LinkedIn).
6. **Missing OAuth scope.** Current connect scope is `openid r_organization_social_feed rw_organization_admin`. The Posts API requires `r_organization_social` to read organization posts. Without it, post retrieval for top content will fail.

## What I Will Change

### 1. Update `linkedin-connect/index.ts` — Add missing scope
- Change scope from `openid r_organization_social_feed rw_organization_admin`
- To: `openid r_organization_social r_organization_social_feed rw_organization_admin`
- This adds `r_organization_social` needed by the Posts API

### 2. Rewrite `sync-linkedin/index.ts` — Use correct APIs

**API version**: Change `LinkedIn-Version` from `202503` to `202603`

**Follower count** — Use `networkSizes` API:
```text
GET /rest/networkSizes/urn:li:organization:{id}?edgeType=COMPANY_FOLLOWED_BY_MEMBER
Response: { "firstDegreeSize": 219145 }
```

**Follower gains** — Use time-bound `organizationalEntityFollowerStatistics`:
```text
GET /rest/organizationalEntityFollowerStatistics?q=organizationalEntity
  &organizationalEntity=urn:li:organization:{id}
  &timeIntervals=(timeRange:(start:{monthStartMs},end:{monthEndMs}),timeGranularityType:MONTH)
Response: elements[].followerGains.organicFollowerGain / paidFollowerGain
```

**Share statistics (aggregate)** — Use time-bound `organizationalEntityShareStatistics`:
```text
GET /rest/organizationalEntityShareStatistics?q=organizationalEntity
  &organizationalEntity=urn:li:organization:{id}
  &timeIntervals=(timeRange:(start:{monthStartMs},end:{monthEndMs}),timeGranularityType:MONTH)
Response: elements[].totalShareStatistics — clickCount, commentCount, likeCount, shareCount,
  impressionCount, uniqueImpressionsCount, engagement (pre-calculated rate)
```
This replaces the current per-post stats fetching entirely for aggregate totals.

**Page statistics** — New data source via `organizationPageStatistics`:
```text
GET /rest/organizationPageStatistics?q=organization
  &organization=urn:li:organization:{id}
  &timeIntervals=(timeRange:(start:{monthStartMs},end:{monthEndMs}),timeGranularityType:MONTH)
Response: elements[].totalPageStatistics.views — allPageViews, allDesktopPageViews, allMobilePageViews
```

**Top content** — Use `posts` API instead of deprecated `ugcPosts`:
```text
GET /rest/posts?author=urn:li:organization:{id}&q=author&count=100&sortBy=CREATED
Header: X-RestLi-Method: FINDER
Response: elements[] with id, commentary, createdAt, publishedAt, content, lifecycleState
```
Then filter posts by month date range. For individual post stats, use `organizationalEntityShareStatistics` with `ugcPosts=List(...)` param for the filtered batch.

**Note on share statistics data window:** The docs state share statistics only returns data within the past 12 months (rolling window). This is a LinkedIn API limitation. Syncing months older than 12 months will return zero for share metrics.

### 3. Updated metrics_data shape
```json
{
  "total_followers": 219145,
  "follower_gains_organic": 223,
  "follower_gains_paid": 12,
  "impressions": 14490816,
  "unique_impressions": 9327,
  "clicks": 109276,
  "likes": 52,
  "comments": 70,
  "shares": 0,
  "engagement": 12345,
  "engagement_rate": 0.75,
  "page_views": 17786,
  "page_views_desktop": 17321,
  "page_views_mobile": 465,
  "posts_published": 15,
  "organizations_count": 1
}
```

### 4. Error handling
- Log exact LinkedIn API responses on failure
- Include full error details in thrown errors
- Non-blocking per-org: if one org's stats fail, continue with others

## Files to Update
- `supabase/functions/linkedin-connect/index.ts` — add `r_organization_social` scope
- `supabase/functions/sync-linkedin/index.ts` — complete rewrite using correct APIs

## What Will NOT Change
- No database schema changes
- No UI changes
- No changes to `oauth-callback/index.ts` (token exchange works fine)
- No changes to LinkedIn Ads (separate integration)

## User Action Required After Deploy
Users will need to **reconnect** their LinkedIn organic connection to get the new `r_organization_social` scope. Existing connections without this scope will still work for aggregate stats (follower count, share stats, page stats) but will fail on the Posts API for top content. The sync will handle this gracefully — top content will be empty if the scope is missing.

