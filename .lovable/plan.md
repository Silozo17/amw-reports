

# Instagram Integration — Zero Reach/Impressions for Current Month

## Root Cause

Instagram data **is syncing and stored correctly**. The problem is specifically that **reach and impressions are 0 for April 2026**, while all other metrics (engagement, video_views, profile_visits, followers, website_clicks) have data.

Looking at the sync function (`sync-instagram/index.ts` line 130):
```
/insights?metric=reach&period=day&since=...&until=...
```

This calls the **IG User-level Insights API** with `metric=reach` and `period=day`. For the **current incomplete month**, Meta's API returns 0 for future/incomplete day values, and the sum ends up being 0 or significantly undercounted. This has happened before (May 2024 also shows all zeros).

The real problem: the function uses `reach` as the **sole source** for both `impressions` and `reach` at the account level (line 276: `impressions: totalReach`). When this API call returns 0, both metrics are wiped out.

## Fix

Update `supabase/functions/sync-instagram/index.ts` to:

1. **Use per-post reach as fallback** — The function already fetches per-media `reach` values (line 207-229) but never aggregates them into the account-level reach. When account-level reach returns 0, sum the individual post reach values instead.

2. **Add `impressions` as a separate metric** — Currently `impressions` is just a copy of `reach` (line 276). Instagram's API supports `impressions` as a separate user-level insight metric. Fetch it alongside reach:
   ```
   /insights?metric=reach,impressions&period=day&since=...&until=...
   ```

3. **Aggregate post-level reach into account reach when API returns 0** — Sum `postReach` from all media items as a floor value, so even if the user-level API fails, we have per-post data.

## Technical Changes

### File: `supabase/functions/sync-instagram/index.ts`

- **Line 130**: Change `metric=reach` to `metric=reach,impressions` to fetch both metrics separately
- **Lines 275-277**: Use `impressions` from the API when available, fall back to post-level reach aggregation, and keep `reach` and `impressions` as independent values
- **After line 255**: Add aggregation of per-post reach as `postLevelReach`, use as fallback when account-level reach is 0:
  ```typescript
  const postLevelReach = allTopMedia.reduce((sum, m) => sum + (m.reach || 0), 0);
  // Use post-level reach as floor when account-level API returns 0
  if (totalReach === 0 && postLevelReach > 0) {
    totalReach = postLevelReach;
  }
  ```

### No database or frontend changes needed

The metrics keys (`reach`, `impressions`) are already displayed correctly by the dashboard. This is purely a data-fetching fix in the edge function.

