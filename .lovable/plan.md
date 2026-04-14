

## Plan: Maximise Google Business Profile Data Pull

### What we gain
- **Reviews and rating** via Google Places API (New) — using the `GOOGLE_API_KEY` already configured
- **2 new engagement metrics**: Message conversations (`BUSINESS_CONVERSATIONS`) and Bookings (`BUSINESS_BOOKINGS`)
- **Top search keywords** — the terms people search to find the business (valuable for reports)
- **Granular impressions breakdown** — store maps vs search and desktop vs mobile separately instead of collapsing

### Changes

**1. Edge function: `supabase/functions/sync-google-business-profile/index.ts`**

- Add `BUSINESS_CONVERSATIONS` and `BUSINESS_BOOKINGS` to the `dailyMetrics` array
- After fetching performance metrics, call the **Places API (New)** to get reviews count and average rating:
  ```
  GET https://places.googleapis.com/v1/places/{placeId}?fields=rating,userRatingCount
  Header: X-Goog-Api-Key: GOOGLE_API_KEY
  ```
  The `placeId` can be derived from the location's `account_id` (which stores the GBP location resource name). We'll need to fetch the location details once via the Account Management API to get the `placeId`, or store it during the account picker step.
- Call the **search keywords endpoint**:
  ```
  GET https://businessprofileperformance.googleapis.com/v1/{location}:searchkeywords/impressions/monthly?monthlyRange.startMonth.year=Y&monthlyRange.startMonth.month=M&monthlyRange.endMonth.year=Y&monthlyRange.endMonth.month=M
  ```
  Store top 10 keywords in `top_content` field (same pattern as other platforms)
- Expand `metricsData` to include:
  - `gbp_conversations` (new)
  - `gbp_bookings` (new)
  - `gbp_reviews_count` (now real data)
  - `gbp_average_rating` (now real data)
  - `gbp_maps_desktop`, `gbp_maps_mobile`, `gbp_search_desktop`, `gbp_search_mobile` (granular breakdown)
- Store search keywords in `top_content` as `[{ keyword, impressions }]`

**2. Frontend metric definitions: `src/types/database.ts`**

Add labels for new metrics:
- `gbp_conversations: 'Messages'`
- `gbp_bookings: 'Bookings'`
- `gbp_maps_desktop / gbp_maps_mobile / gbp_search_desktop / gbp_search_mobile` labels

Add to `PLATFORM_METRICS.google_business_profile` array.

**3. Frontend metric tooltips: `src/types/metrics.ts`**

Add tooltip descriptions for each new metric.

**4. Dashboard display: `src/components/clients/dashboard/PlatformSection.tsx`**

Add new metrics to `GBP_KEY_METRICS` array.

**5. Metric defaults seed (optional, via DB)**

Update `metric_defaults` table for `google_business_profile` to include the new metric keys in both `available_metrics` and `default_metrics`.

### Risk note
- The Places API (New) call uses `GOOGLE_API_KEY` which is already set. This API has a per-request cost (~$0.005 per call) but we only call it once per sync per location — negligible.
- Search keywords endpoint may return empty for locations with low traffic. We handle this gracefully.
- `BUSINESS_CONVERSATIONS` and `BUSINESS_BOOKINGS` may return 0 for businesses that don't use those features — we'll include them as optional metrics (not in defaults).

### Files changed

| File | Change |
|---|---|
| `supabase/functions/sync-google-business-profile/index.ts` | Add conversations, bookings, reviews via Places API, search keywords, granular breakdown |
| `src/types/database.ts` | Add metric labels + platform metrics list |
| `src/types/metrics.ts` | Add tooltip descriptions |
| `src/components/clients/dashboard/PlatformSection.tsx` | Update `GBP_KEY_METRICS` |
| Database: `metric_defaults` | Update available/default metrics for GBP |

### No other changes needed
- OAuth scope (`business.manage`) already covers everything
- Connect function unchanged
- No new secrets required

