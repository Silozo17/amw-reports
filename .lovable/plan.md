
# Plan: Dashboard Redesign, Data Sync Fixes, Report Overhaul

## Status: ✅ All Phases Complete

### Phase 1: Fix Data Sync ✅
- Added month/year picker to sync button via Popover
- Added "Sync Last 12 Months" bulk sync option
- Removed hardcoded previous-month logic

### Phase 2: Fix Google Ads Account Names ✅
- oauth-callback now queries `descriptive_name` for each Google Ads customer
- Falls back to ID-based name if API fails

### Phase 3: Redesign Client Dashboard ✅
- New DashboardHeader with platform selector (single-focus) + time range (Monthly/Weekly/Quarterly/Custom)
- KPI hero cards with MoM comparison
- Donut charts for spend/engagement, bar chart for impressions/clicks
- Trend line chart across months
- Demographics placeholder section
- Spacious layout with 4-column KPI grid

### Phase 4: Redesign PDF Report ✅
- Cover page with decorative accent strip
- KPI hero cards with MoM arrows
- Per-platform sections with metric cards + simulated bar charts
- Engagement distribution page with horizontal bars
- Top content page
- Demographics/audience placeholder page
- AI insights + recommendations pages
- Closing page

### Phase 5: Google Ads Name in Picker ✅
- Shows descriptive name prominently
- Formats account ID with dashes (XXX-XXX-XXXX)
- Shows warning if name is still generic
