

## Plan: Platform Improvements — Metrics, Reports, Connections Disclaimer, Interactive Dashboard, and Competitive Overhaul

This is a large improvement plan organized into 5 sections matching your requests, plus a competitive analysis section.

---

### 1. Verify Metric Settings for Each Platform

**Problem:** The `metric_defaults` table already has platform-specific `available_metrics` and `default_metrics` for all 6 platforms. However, the MetricConfigPanel falls back to `Object.keys(METRIC_LABELS)` (all 40+ metrics) when no defaults exist, which can show irrelevant metrics.

**Fix:**
- Ensure `MetricConfigPanel.tsx` line 201 uses a filtered fallback instead of all METRIC_LABELS keys — only show metrics relevant to the platform type (use `AD_METRICS` and `ORGANIC_PLATFORMS` sets to filter)
- Add missing metrics to `METRIC_LABELS` and `METRIC_EXPLANATIONS` if any `available_metrics` from the defaults table aren't covered (current coverage looks complete)
- No database changes needed — defaults are already correctly populated

**Files:** `src/components/clients/MetricConfigPanel.tsx`

---

### 2. Verify Email Templates and Report Sending

**Problem:** Email sending uses the `send-report-email` edge function with Resend. The function and template exist and appear functional.

**Verification steps:**
- Confirm the `RESEND_API_KEY` secret is set (it is)
- Confirm the `send-report-email` edge function is deployed
- Ensure the Reports page has "Send" buttons that call `sendReportEmail` (it does)
- Add a "Send Test Email" button on the Reports page or per-report so you can verify delivery without waiting for the automation cycle
- Add visual confirmation on the Reports page showing email delivery status from `email_logs` table

**Files:** `src/pages/Reports.tsx`, `supabase/functions/send-report-email/index.ts` (redeploy to ensure latest version is live)

---

### 3. Connection Data Disclaimer

**Problem:** No data privacy/usage disclaimer is shown in the Connections tab.

**What to add:** Below the connections list (and inside the ConnectionDialog), add a collapsible disclaimer card explaining:
- **What data is collected:** Platform performance data (impressions, reach, engagement, ad spend, followers) via official APIs (Google Ads API, Meta Graph API, TikTok Marketing API, LinkedIn Marketing API)
- **Why:** To generate automated marketing performance reports
- **How it's stored:** Securely in cloud infrastructure, encrypted at rest, access tokens stored server-side
- **Data retention:** Data is retained while the connection is active. When a connection is removed, all associated performance data, sync logs, and configuration are permanently deleted
- **Meta-specific clause:** "Data obtained through Meta APIs is used solely to provide reporting and analytics features. We do not share, sell, or transfer Meta user data to third parties."
- **Google-specific:** "Google Ads data is accessed in compliance with Google API Services User Data Policy"

**Files:** New component `src/components/clients/ConnectionDisclaimer.tsx`, modify `src/pages/clients/ClientDetail.tsx` (Connections tab), modify `src/components/clients/ConnectionDialog.tsx`

---

### 4. Interactive Dashboard with Explanations and Hover Data

**Problem:** (a) Metric explanations from `METRIC_EXPLANATIONS` exist in code but aren't prominently visible on the dashboard — they only show as tiny text at the bottom of each metric tile in `PlatformMetricsCard`. (b) KPI sparkline cards and charts don't show interactive hover tooltips with historical data points.

**Fixes:**

**(a) Prominent metric explanations:**
- Add visible explanation text below each section header in `ClientDashboard.tsx` (e.g., under "Platform Details" add "Detailed breakdown of how each connected platform performed this period")
- In `PlatformMetricsCard.tsx`, make the explanation text more prominent — increase font size from 10px to 12px, use slightly darker color, and add an info icon
- Add section descriptions to charts: "Spend Distribution — See how your ad budget is split across platforms", "Engagement Breakdown — How people are interacting with your content", "Performance Trend — How your key metrics have changed over the last 6 months"

**(b) Interactive hover on charts and cards:**
- **KPI Sparkline Cards:** Add `<RechartsTooltip>` to each sparkline `<AreaChart>` so hovering shows the value and month name for each data point. Add `activeDot` to show a highlighted dot on hover. Pass month labels into sparkline data (currently only `{ v: number }`, change to `{ v: number, name: string }`)
- **Trend Area Chart:** Already has `<RechartsTooltip>` but uses default formatter — add a custom formatter showing currency for spend, formatted numbers for other metrics, and the month label
- **Bar Charts:** Already have tooltips — enhance the formatter to show formatted values (currency symbol for spend)
- **Donut Chart:** Already has tooltip — enhance to show percentage and formatted currency
- **PlatformMetricsCard individual tiles:** Add a mini sparkline to each metric tile using the 6-month trend data. Pass `trendData` down to `PlatformMetricsCard` so each metric can show its own historical sparkline with hover interaction

**Files:** `src/components/clients/ClientDashboard.tsx`, `src/components/clients/PlatformMetricsCard.tsx`, `src/components/clients/SectionHeader.tsx`

---

### 5. Competitive Analysis and Platform Improvement Plan

After analyzing DashThis, AgencyAnalytics, Whatagraph, Swydo, and your AMW PDF report style, here are the key features that would elevate the platform from 3/10 to 10/10:

#### Tier 1 — High Impact, Implement Now

**A. White-label Client Portal (read-only shareable dashboards)**
- Like DashThis's "share URL" feature — generate a read-only link clients can bookmark
- Clients see their own dashboard without needing to log in (token-based access)
- Branded with client's logo, AMW branding optional
- This is the #1 feature every competitor has that you're missing

**B. Goal Tracking & Benchmarks**
- Set target KPIs per client/platform (e.g., "Target: 50K reach/month")
- Show progress bars and goal achievement % on dashboard
- Industry benchmarks: "Your CTR of 2.1% is above the industry average of 1.8%"
- DashThis, AgencyAnalytics, and Whatagraph all have this

**C. Annotations & Notes on Timeline**
- Allow adding notes to specific months ("Launched new campaign", "Christmas sale")
- Show as markers on trend charts
- Critical for explaining data spikes/dips to clients

**D. Enhanced Data Visualization**
- **Cross-platform comparison charts:** Side-by-side bar charts comparing the same metric across all platforms
- **Conversion funnel:** Impressions → Clicks → Conversions visualized as a funnel
- **Period-over-period overlay:** Overlay current period's trend line on top of previous period for visual comparison
- **Heatmap calendar:** Show daily/weekly performance intensity (like GitHub contribution graph)

#### Tier 2 — Medium Impact, Build Next

**E. Automated Insights & Anomaly Detection**
- Automatically flag when metrics deviate significantly from normal (e.g., "Spend increased 150% this week")
- Weekly email digest with top insights per client
- Currently you have on-demand AI analysis — make it automatic and persistent

**F. Report Templates & Customization**
- Multiple PDF report templates (executive summary, detailed, social-only, ads-only)
- Drag-and-drop section ordering for reports
- Custom branding per client (colors, logo placement)
- DashThis and Whatagraph excel at this

**G. Multi-Client Overview Dashboard**
- The main Dashboard page is currently sparse — add an aggregate view showing all clients' KPIs in a table/grid
- Quick health indicators (green/amber/red) per client based on metric trends
- "Clients needing attention" section highlighting failed syncs, declining metrics

**H. CSV/Excel Export**
- Export any dashboard view or date range as CSV/Excel
- Scheduled export delivery via email
- Every competitor has this

#### Tier 3 — Polish & Differentiation

**I. Mobile-Responsive Dashboard**
- Ensure all charts, KPI cards, and tables work well on mobile
- DashThis specifically markets "mobile-friendly dashboards"

**J. Comparison/Competitive Analysis**
- Compare client's performance against their own historical averages
- "Best performing month" and "Worst performing month" highlights

**K. Widget/Card Customization**
- Let users toggle which charts appear on the dashboard
- Reorder sections via drag-and-drop
- Choose between chart types (bar vs line vs area) per widget

**L. Notification System**
- In-app notifications for completed syncs, failed syncs, new reports
- Bell icon in the header with notification count

---

### Implementation Priority for This Session

Given the scope, I recommend implementing in this order:

1. **Connection Disclaimer** (new component + integration) — 1 file created, 2 modified
2. **Interactive Dashboard Hover + Explanations** — 3 files modified  
3. **Metric Config Filtering Fix** — 1 file modified
4. **Report Email Verification Enhancement** — 1 file modified
5. **Multi-Client Overview on Main Dashboard** — 1 file modified (Index.tsx)
6. **Cross-platform Comparison Chart** — added to ClientDashboard
7. **Goal Tracking UI** (requires 1 new DB table + UI components)

### Technical Details

**Database changes needed:**
- New table `client_goals` for goal tracking: `id, client_id, platform, metric_key, target_value, period_type, created_at`
- New table `dashboard_annotations` for timeline notes: `id, client_id, note_text, annotation_month, annotation_year, created_at, created_by`
- New table `shared_dashboard_tokens` for white-label client portal: `id, client_id, token, expires_at, is_active, created_at`

**New files:**
- `src/components/clients/ConnectionDisclaimer.tsx`
- `src/components/clients/CrossPlatformChart.tsx`  
- `src/components/clients/ConversionFunnel.tsx`

**Modified files:**
- `src/components/clients/ClientDashboard.tsx` — section descriptions, enhanced tooltips, per-metric sparklines, new chart sections
- `src/components/clients/PlatformMetricsCard.tsx` — mini sparklines per metric, bigger explanations, accept trendData prop
- `src/components/clients/MetricConfigPanel.tsx` — filter fallback metrics by platform type
- `src/pages/clients/ClientDetail.tsx` — add disclaimer to connections tab
- `src/components/clients/ConnectionDialog.tsx` — add disclaimer
- `src/pages/Index.tsx` — multi-client overview with health indicators
- `src/pages/Reports.tsx` — email status display, test send button

