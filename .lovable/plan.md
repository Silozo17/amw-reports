

# Expand Google Analytics Data Collection & Dashboard Display

## Current State

**Currently synced (7 metrics + 2 tables):**
- sessions, active_users, new_users, ga_page_views, bounce_rate, avg_session_duration, pages_per_session
- Top 20 pages (page path, views, users)
- Traffic sources by channel group (source, sessions, users)

**Currently missing:** Geographic data, device breakdown, user demographics, conversions, engagement rate, landing pages, referrals, and event data.

## What the GA4 Data API Can Provide

The GA4 `runReport` endpoint supports 100+ metrics and dimensions. Here are the high-value additions grouped by category:

### New Metrics (aggregate KPIs)
| Metric | GA4 API Name | Value |
|---|---|---|
| Total Users | `totalUsers` | Distinct user count |
| Engaged Sessions | `engagedSessions` | Sessions > 10s or with conversion |
| Engagement Rate | `engagementRate` | Inverse of bounce rate, more modern |
| Conversions | `conversions` | Total conversion events |
| Event Count | `eventCount` | All tracked events |
| User Engagement Duration | `userEngagementDuration` | Total engagement time |

### New Dimension Reports (stored in `raw_data` / `top_content`)

| Report | Dimensions | Metrics | Dashboard Display |
|---|---|---|---|
| **Geographic (Country)** | `country`, `countryId` | `activeUsers`, `sessions` | **World heatmap** with color intensity by user count |
| **Geographic (City)** | `city`, `country` | `activeUsers`, `sessions` | Table below heatmap with top 30 cities |
| **Device Category** | `deviceCategory` | `activeUsers`, `sessions` | Donut chart (Desktop/Mobile/Tablet) |
| **Browser** | `browser` | `activeUsers` | Horizontal bar chart |
| **Operating System** | `operatingSystem` | `activeUsers` | Horizontal bar chart |
| **Landing Pages** | `landingPage` | `sessions`, `activeUsers`, `bounceRate` | Table with bounce rate per page |
| **Referral Sources** | `sessionSource`, `sessionMedium` | `sessions`, `activeUsers` | Table with source/medium pairs |
| **New vs Returning** | `newVsReturning` | `activeUsers`, `sessions` | Pie/donut chart |
| **Page Title** | `pageTitle` | `screenPageViews`, `userEngagementDuration` | Enhanced top pages table |

### About the World Heatmap

GA4 provides `country` and ISO `countryId` dimensions. We can fetch users-per-country and render a **choropleth world map** using a lightweight SVG map component. This is *not* real-time data — it's the synced monthly snapshot data showing geographic distribution for that period. True real-time requires the GA4 Realtime API (`runRealtimeReport`), which only returns the last 30 minutes and would need constant polling — not suitable for our monthly snapshot architecture.

**Recommendation:** Display the geographic heatmap as "User Distribution by Country" for the selected period, which is accurate and valuable for client reporting.

---

## Plan

### 1. Expand sync-google-analytics edge function
Add 5 new API calls (parallelized with `Promise.all`) to the existing sync:

- **Geographic report:** dimension `country` + `countryId`, metrics `activeUsers`, `sessions` → top 50 countries
- **City report:** dimension `city`, `country`, metrics `activeUsers`, `sessions` → top 30 cities  
- **Device report:** dimension `deviceCategory`, metrics `activeUsers`, `sessions`
- **New vs Returning:** dimension `newVsReturning`, metrics `activeUsers`, `sessions`
- **Landing pages:** dimension `landingPagePlusQueryString`, metrics `sessions`, `bounceRate` → top 20

Add 3 new aggregate metrics to the main report request: `totalUsers`, `engagedSessions`, `engagementRate`

Store all new data in `raw_data` (geographic, devices, landing pages) and add new keys to `metrics_data` (total_users, engaged_sessions, engagement_rate).

**File:** `supabase/functions/sync-google-analytics/index.ts`

### 2. Update metric definitions in database.ts
Add new metric keys to the `google_analytics` available metrics array and add labels to `METRIC_LABELS`:
- `total_users`, `engaged_sessions`, `engagement_rate`
- `geo_countries` (table), `geo_cities` (table), `device_breakdown` (chart), `new_vs_returning` (chart), `landing_pages` (table)

**File:** `src/types/database.ts`

### 3. Add world heatmap component
Create a new `GeoHeatmap` component using an inline SVG world map (no heavy dependencies). Countries colored by user intensity on a gradient scale (light → brand color). Hover tooltip showing country name, users, sessions. Below the map, a sortable table of top 30 cities.

**File:** `src/components/clients/dashboard/GeoHeatmap.tsx` (new)

### 4. Add device breakdown chart
Create a `DeviceBreakdown` component with a donut chart showing Desktop/Mobile/Tablet split, plus a "New vs Returning" mini donut beside it.

**File:** `src/components/clients/dashboard/DeviceBreakdown.tsx` (new)

### 5. Update PlatformSection to render new GA4 widgets
When platform is `google_analytics`, render the new components (GeoHeatmap, DeviceBreakdown) below the existing metrics cards, using data from `raw_data`.

**File:** `src/components/clients/dashboard/PlatformSection.tsx`

### 6. Update portal-data edge function
Ensure `raw_data` is included in the portal response for GA4 snapshots so client portal users also see the new visualizations.

**File:** `supabase/functions/portal-data/index.ts`

---

## Technical Details

- All new GA4 API calls use the same `runReport` endpoint with different dimension/metric combinations
- New calls are wrapped in try/catch (non-blocking) so a failure in geographic data doesn't break the core sync
- The world map SVG is ~15KB inline (standard 110-country simplified paths) — no external dependency
- Country matching uses ISO 2-letter codes from GA4's `countryId` dimension
- Geographic and device data stored in `raw_data.geoCountries`, `raw_data.geoCities`, `raw_data.devices`, `raw_data.newVsReturning`, `raw_data.landingPages`
- No database migration needed — all new data fits in existing `metrics_data` (JSONB) and `raw_data` (JSONB) columns

**Files modified:** 6 files (2 edge functions, 1 type file, 1 existing component, 2 new components)

