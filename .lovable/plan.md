

## Fix: GBP Rating Summing + Reviews Not Fetching

### Two Issues

**Issue 1: Rating shows 20 instead of 5 in multi-month views**
The `aggregateMultiMonth` function in `useClientDashboard.ts` (line 139) sums all metrics blindly. When viewing YTD with 4 months of `gbp_average_rating: 5.0`, it shows 20.0. Same problem for `gbp_reviews_count` — it sums instead of taking the latest value.

**Issue 2: Reviews not being fetched**
Edge function logs confirm the GMB reviews API returns 404. The URL is:
```
https://mybusiness.googleapis.com/v4/locations/11903806665193965801/reviews
```
But the v4 API requires the full account path:
```
https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
```
The oauth-callback stores `loc.name` (e.g. `locations/12345`) as `account_id`, but discards the parent `acct.name` (e.g. `accounts/67890`).

---

### Fix 1: Dashboard aggregation (frontend)

**File: `src/hooks/useClientDashboard.ts`** — `aggregateMultiMonth` function (lines 139-160)

Add a set of cumulative/latest-value metrics that should NOT be summed. Instead, take the latest snapshot's value (by report_year/month). Also preserve `top_content` in the aggregated output.

```typescript
const LATEST_VALUE_METRICS = new Set([
  'gbp_average_rating', 'gbp_reviews_count', 'total_followers',
  'followers', 'subscribers', 'following', 'total_pins',
  'total_boards', 'total_video_count', 'media_count'
]);
```

For these metrics, sort snapshots by year/month descending and take the first non-null value. For `total_followers`, keep existing `Math.max` logic. Also merge `top_content` arrays across snapshots.

**File: `src/hooks/useClientDashboard.ts`** — `aggregateMultiMonth` function

Update to:
- Track latest snapshot per platform (by year/month)
- Use latest value for cumulative metrics instead of summing
- Merge `top_content` from all snapshots into the aggregated result

### Fix 2: Reviews API URL (edge function)

**File: `supabase/functions/oauth-callback/index.ts`**

When discovering locations, store the parent account name alongside the location in metadata:
```typescript
locations.push({ id: locId, name: loc.title || locId, accountName: acct.name });
```

Also store the `accountName` in `metadata` when auto-selecting.

**File: `supabase/functions/sync-google-business-profile/index.ts`** — `fetchReviewsData`

Update the reviews URL to use the full account+location path. Extract the account name from `conn.metadata.locations` or fall back to constructing it. Change:
```
https://mybusiness.googleapis.com/v4/${locationId}/reviews
```
To:
```
https://mybusiness.googleapis.com/v4/${accountName}/${locationId}/reviews
```

Where `accountName` is retrieved from `conn.metadata`.

**Fallback**: If `accountName` isn't in metadata (existing connections), try to discover it via the Account Management API (`https://mybusinessaccountmanagement.googleapis.com/v1/accounts`) during sync, then cache it in metadata for future use.

### Files Changed
1. `src/hooks/useClientDashboard.ts` — fix aggregation for cumulative metrics + preserve top_content
2. `supabase/functions/oauth-callback/index.ts` — store account name in location metadata
3. `supabase/functions/sync-google-business-profile/index.ts` — fix reviews URL using account name

### Risk
- Existing GBP connections won't have `accountName` in metadata until re-connected. The fallback account discovery during sync handles this.
- No database migration needed.

