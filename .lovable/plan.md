

## Plan: Add Google Search Console, Google Analytics, and Google Business Profile Integrations

### What's Needed

You already have Google Cloud Console set up with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secrets configured. The existing Google Ads integration pattern (connect → OAuth → callback → sync) can be reused for all three new platforms.

### Prerequisites (Google Cloud Console Steps — You Do These)

Before I build the code, you need to enable these APIs in your Google Cloud Console project:

1. **Google Search Console API** — Enable "Google Search Console API" in APIs & Services → Library
2. **Google Analytics Data API** (GA4) — Enable "Google Analytics Data API" in APIs & Services → Library  
3. **Google My Business API / Business Profile Performance API** — Enable "Business Profile Performance API" and "My Business Business Information API"

No new secrets are needed — the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` work for all Google APIs. The OAuth consent screen just needs the additional scopes added (Google auto-approves most read-only scopes).

---

### Implementation

#### 1. Database: Extend PlatformType Enum

Add `google_search_console`, `google_analytics`, and `google_business_profile` to the `platform_type` enum via migration.

Add rows to `metric_defaults` for each new platform with appropriate available/default metrics.

#### 2. Frontend Types & Labels

Update `src/types/database.ts`:
- Extend `PlatformType` union with the 3 new types
- Add entries to `PLATFORM_LABELS`, `PLATFORM_LOGOS` (use the Google logo for all three, or add distinct logos)
- Add to `ORGANIC_PLATFORMS` set (none of these have ad spend)
- Add new metric keys to `METRIC_LABELS` (e.g., `search_clicks`, `search_impressions`, `search_ctr`, `search_position`, `sessions`, `active_users`, `bounce_rate`, `avg_session_duration`, `page_views_per_session`, `gbp_views`, `gbp_searches`, `gbp_calls`, `gbp_direction_requests`, `gbp_website_clicks`, `gbp_reviews_count`, `gbp_average_rating`)

#### 3. Connection Dialog

Update `src/components/clients/ConnectionDialog.tsx`:
- Add the 3 new platforms to the `PLATFORMS` array
- Add to `OAUTH_SUPPORTED` and `CONNECT_FUNCTION_MAP`

#### 4. OAuth Connect Functions (3 new edge functions)

Each follows the same pattern as `google-ads-connect/index.ts` but with different OAuth scopes:

- **`google-search-console-connect`** — scope: `https://www.googleapis.com/auth/webmasters.readonly`
- **`google-analytics-connect`** — scope: `https://www.googleapis.com/auth/analytics.readonly`
- **`google-business-connect`** — scopes: `https://www.googleapis.com/auth/business.manage` (for reading performance data and business info)

#### 5. OAuth Callback Handler

Update `supabase/functions/oauth-callback/index.ts`:
- Add `handleGoogleSearchConsole`, `handleGoogleAnalytics`, `handleGoogleBusinessProfile` cases
- Each exchanges the auth code for tokens (same Google token endpoint) and discovers available properties/accounts to store in `metadata` for the Account Picker

**Discovery logic per platform:**
- **GSC**: Call `https://www.googleapis.com/webmasters/v3/sites` to list verified sites
- **GA4**: Call `https://analyticsadmin.googleapis.com/v1beta/accounts` then list properties per account
- **GBP**: Call `https://mybusinessbusinessinformation.googleapis.com/v1/accounts` then list locations

#### 6. Account Picker Updates

Update `src/components/clients/AccountPickerDialog.tsx`:
- Add rendering for GSC (list of verified sites to pick from)
- Add rendering for GA4 (list of properties to pick from)
- Add rendering for GBP (list of business locations to pick from)

#### 7. Sync Functions (3 new edge functions)

- **`sync-google-search-console`** — Queries the Search Analytics API for the selected month: `https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`. Stores clicks, impressions, CTR, average position, top queries, top pages.

- **`sync-google-analytics`** — Queries the GA4 Data API: `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`. Stores sessions, active users, page views, bounce rate, avg session duration, new vs returning users, top pages, traffic sources.

- **`sync-google-business-profile`** — Queries the Business Profile Performance API: `https://businessprofileperformance.googleapis.com/v1/locations/{locationId}:getDailyMetricsTimeSeries`. Stores views, searches, calls, direction requests, website clicks, reviews count, average rating.

Each follows the existing pattern: refresh token → query API → aggregate monthly data → upsert `monthly_snapshots`.

#### 8. Metric Explanations

Add to `src/types/metrics.ts` explanations for all new metrics (e.g., `search_position: "Average ranking position in Google search results"`, `gbp_calls: "Number of phone calls made from your Google Business Profile"`).

---

### Files Summary

**New edge functions (6 files):**
- `supabase/functions/google-search-console-connect/index.ts`
- `supabase/functions/google-analytics-connect/index.ts`
- `supabase/functions/google-business-connect/index.ts`
- `supabase/functions/sync-google-search-console/index.ts`
- `supabase/functions/sync-google-analytics/index.ts`
- `supabase/functions/sync-google-business-profile/index.ts`

**Modified files:**
- `supabase/functions/oauth-callback/index.ts` — 3 new platform handlers
- `src/types/database.ts` — Extended PlatformType, labels, logos, metrics
- `src/types/metrics.ts` — New metric explanations
- `src/components/clients/ConnectionDialog.tsx` — 3 new platform options
- `src/components/clients/AccountPickerDialog.tsx` — Picker UI for new platforms
- `src/components/clients/MetricConfigPanel.tsx` — Ensure new platforms filter correctly

**Database migration:**
- Alter `platform_type` enum to add 3 values
- Insert `metric_defaults` rows for new platforms

### Your Action Items Before I Build

1. Enable **Google Search Console API** in Google Cloud Console
2. Enable **Google Analytics Data API** in Google Cloud Console
3. Enable **Business Profile Performance API** and **My Business Business Information API** in Google Cloud Console
4. Confirm these are enabled, then I'll implement everything

