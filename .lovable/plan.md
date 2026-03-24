

# Plan: Dashboard Redesign, Data Sync Fixes, Report Overhaul

## Root Cause Analysis

After inspecting the database, edge functions, and UI:

1. **Data shows zeros** because the sync only pulls the previous month (Feb 2026), and for AMW Media's selected accounts there was genuinely no ad spend or activity in February. The sync button hardcodes `now.getMonth()` which means March only syncs February. There is no way to sync older months or custom ranges.

2. **Google Ads shows "Google Ads (1848743396)" instead of real names** because `oauth-callback/index.ts` line 148 only calls `listAccessibleCustomers` which returns IDs, not names. It never queries the Google Ads API for the descriptive account name.

3. **Dashboard is cramped** because all platforms are shown as flat grids of small 3-column metric cards with no visual hierarchy, no spacing, and no way to focus on a single platform.

4. **PDF reports** use basic jsPDF rectangles and text - no charts, no demographics, no visual appeal matching the reference images.

---

## Execution Order

### Phase 1: Fix Data Sync (allow any month/year)

**Files:** `src/pages/clients/ClientDetail.tsx`, `src/components/clients/ClientDashboard.tsx`

- Add a **date range picker** to the sync button: let users pick which month/year to sync (or a range of months going back as far as needed)
- Add weekly/monthly/quarterly/custom toggle to the dashboard header
- The sync functions already accept `month` and `year` params, so the backend works - just the frontend hardcodes previous month
- Add a "Sync All History" button that loops through months back to a configurable start date

### Phase 2: Fix Google Ads Account Names

**File:** `supabase/functions/oauth-callback/index.ts`

- After `listAccessibleCustomers`, query each customer's descriptive name via `GET https://googleads.googleapis.com/v20/customers/{id}` using the `customer.descriptive_name` field
- Update the `customers` array to use real names: `{ id: custId, name: descriptiveName || "Google Ads (custId)" }`

### Phase 3: Redesign Client Dashboard

**Files:** `src/components/clients/ClientDashboard.tsx` (rewrite), `src/components/clients/PlatformMetricsCard.tsx` (rewrite), new `src/components/clients/DashboardHeader.tsx`

Inspired by the 3 reference images, the new dashboard will have:

- **Top bar**: Platform selector (single-focus tabs: All Platforms / Google Ads / Meta Ads / Facebook / Instagram / etc.) + Time range selector (Weekly / Monthly / Quarterly / Custom with date picker)
- **KPI Summary Row**: 4-6 large hero cards showing total spend, total reach, total engagement, total followers with MoM % change badges (like the "Social Media Monthly Report" reference)
- **Charts Section** (2-column grid):
  - Spend distribution donut chart (larger, with legend)
  - Engagement per channel donut chart
  - Impressions & Clicks bar chart
  - Engagement trend line chart (when multi-month data exists)
- **Platform Detail Sections**: Each platform in its own well-spaced card with:
  - Platform icon + name header
  - 2-3 column grid of metrics with (i) tooltips
  - MoM trend indicators
  - "Data unavailable" placeholder for metrics without data
- **AI Analysis Card**: Existing feature, kept at bottom
- Spacious layout with generous padding, larger fonts, clear section dividers

### Phase 4: Redesign PDF Report

**File:** `supabase/functions/generate-report/index.ts` (major rewrite)

Inspired by the reference images, the PDF will include:

- **Cover page**: AMW branding (existing, kept)
- **Executive Summary page**: AI summary + 4 hero KPI boxes with MoM changes
- **Platform Overview page**: Per-platform sections with metric cards in a cleaner grid layout, more spacing, proper value formatting
- **Engagement Breakdown page**: Text-based "chart" representations (percentage bars using jsPDF rectangles to simulate bar charts)
- **Top Content page**: Table of top-performing posts/campaigns per platform
- **Demographics placeholder page**: "Audience insights coming soon" section with placeholder layout (for when demographic data becomes available)
- **AI Insights page**: Platform-by-platform analysis (existing)
- **Recommendations page**: Upsell content if enabled (existing)
- **Closing page**: Thank you (existing)
- When a metric section has no data, show a styled placeholder: "Data for [section] will be available once synced"

### Phase 5: Google Ads Account Name in Picker

**File:** `src/components/clients/AccountPickerDialog.tsx`

- For Google Ads, display the descriptive name prominently (from updated metadata) and show the account ID as secondary text
- Already mostly works once Phase 2 populates real names

---

## Technical Details

### Dashboard State Management
- `selectedPlatform`: `'all' | PlatformType` - filter which platform's data to show
- `selectedPeriod`: `{ type: 'monthly' | 'weekly' | 'quarterly' | 'custom', month: number, year: number, startDate?: Date, endDate?: Date }`
- Fetch snapshots based on selected period, not hardcoded previous month
- For weekly view: show the current month's daily data broken into weeks (requires daily data which the APIs already provide but we currently aggregate into monthly)
- For quarterly: aggregate 3 months of snapshots

### Sync Enhancement
- `handleManualSync` will accept a `month` and `year` parameter
- Add a "Bulk Sync" option that syncs multiple months in sequence
- Show progress indicator during bulk sync

### Google Ads Name Resolution
- In `handleGoogleAds` in `oauth-callback/index.ts`, after getting the customer IDs, make a `searchStream` query for each: `SELECT customer.descriptive_name, customer.id FROM customer WHERE customer.id = '{custId}'`
- This requires the developer token and access token (both available at that point)

### PDF Improvements (within jsPDF constraints)
- Simulated bar charts using colored rectangles
- Percentage bars for metric comparisons
- Better typography hierarchy
- More whitespace between sections
- Proper page breaks
- Demographic/audience placeholder sections

### Files Modified
- `src/components/clients/ClientDashboard.tsx` - full rewrite
- `src/components/clients/PlatformMetricsCard.tsx` - redesign for spaciousness
- `src/components/clients/DashboardHeader.tsx` - new component for platform/time controls
- `src/pages/clients/ClientDetail.tsx` - sync with date picker, pass period to dashboard
- `supabase/functions/oauth-callback/index.ts` - Google Ads name resolution
- `supabase/functions/generate-report/index.ts` - PDF redesign
- `src/components/clients/AccountPickerDialog.tsx` - minor tweak for Google Ads name display

