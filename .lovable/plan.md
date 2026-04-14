

## Plan: GBP Star Ratings, Latest Reviews, and Hero KPI Icon Fix

### 1. Display average rating as stars in GBP metric card

**File: `src/components/clients/dashboard/PlatformSection.tsx`**

- In the `MetricCard` component (or as a special-case render for `gbp_average_rating`), render filled/half/empty star icons instead of a plain number. Example: 4.3 becomes ★★★★☆ with the numeric value shown alongside.
- Add a check: if `metricKey === 'gbp_average_rating'`, render a `StarRating` inline component instead of the standard `formatMetricValue` output.

### 2. Add new reviews count and latest 5 reviews

**Backend: `supabase/functions/sync-google-business-profile/index.ts`**

- Expand the `fetchReviewsData` function to also call the Places API reviews endpoint:
  ```
  GET https://places.googleapis.com/v1/places/{placeId}?fields=rating,userRatingCount,reviews
  ```
  This returns the 5 most relevant reviews with `author`, `rating`, `text`, `relativePublishTimeDescription`, and `publishTime`.
- Add `gbp_new_reviews` to `metricsData` (calculated as difference from previous snapshot's `gbp_reviews_count`, or just stored as the raw count for now).
- Store the reviews array in `top_content` alongside existing search keywords. Format:
  ```json
  { "type": "review", "author": "...", "rating": 5, "text": "...", "relative_time": "a week ago" }
  ```
  Merge with existing keyword entries (keywords get `type: "keyword"`).

**Frontend: `src/components/clients/dashboard/PlatformSection.tsx`**

- Add a `TopContentItem` field for `rating` and `author` and `relative_time`.
- Filter GBP top content by `type === 'review'` and render a collapsible "Latest Reviews" table showing: star rating (as stars), author name, review snippet, and time ago.
- Filter by `type === 'keyword'` for the existing search keywords display (add a separate collapsible "Top Search Keywords" for GBP).

**Frontend: `src/types/metrics.ts`**

- Add tooltip for `gbp_new_reviews`.

**Frontend: `src/types/database.ts`**

- Add `gbp_new_reviews` label to `METRIC_LABELS` and `PLATFORM_METRICS`.

### 3. Fix hero KPI icons clipped on smaller screens

**File: `src/components/clients/dashboard/HeroKPIs.tsx`**

- The icon container (line 98-103) uses fixed `h-8 w-8` which gets clipped when the card is narrow. Add `shrink-0` to the icon wrapper div to prevent it from being crushed by flex layout.
- The platform logo images (line 109-127) also need `shrink-0` on the container to prevent clipping.

### Files changed

| File | Change |
|---|---|
| `supabase/functions/sync-google-business-profile/index.ts` | Fetch reviews from Places API, add to top_content, add gbp_new_reviews metric |
| `src/components/clients/dashboard/PlatformSection.tsx` | Star rating display for gbp_average_rating, reviews table for GBP, keywords table for GBP |
| `src/components/clients/dashboard/HeroKPIs.tsx` | Add `shrink-0` to icon wrapper and platform logos container |
| `src/types/database.ts` | Add `gbp_new_reviews` label |
| `src/types/metrics.ts` | Add `gbp_new_reviews` tooltip |

### Database
- Update `metric_defaults` for `google_business_profile` to include `gbp_new_reviews` in `available_metrics`.

