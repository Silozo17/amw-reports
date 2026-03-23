
# AMW Media Internal Reporting Platform

## Overview
A private internal web app for AMW Media's team (2–3 users) to manage ~6–20 clients, pull real marketing data from connected platforms, generate branded PDF reports with AI-powered insights, and auto-email them to clients monthly.

---

## 1. Authentication & User Roles
- Lovable Cloud auth with email/password login (internal team only)
- Two roles: **Owner** (full access) and **Manager** (limited — no user management or global settings)
- Role-based access enforced via Supabase RLS

## 2. AMW Branding & Design System
- Apply brand colors throughout: Off-White (#f4ede3), Black (#241f21), Purple (#b32fbf), Blue (#539BDB), Green (#4ED68E), Orange (#EE8733)
- Typography: Anton (headlines/headings), Montserrat (body/UI), Slowdex (annotations/accents)
- Color hierarchy: 30% Off-White, 20% Black, 20% Purple, 15% Blue, 10% Green, 5% Orange
- Dark, bold, premium dashboard aesthetic matching the brand guide

## 3. Dashboard & Navigation
- **Main Dashboard**: Active clients count, upcoming sync/report status, failed connections, failed syncs, failed emails, quick actions
- **Clients**: List/detail views with full profile management
- **Reports**: Monthly report browser with status, download, preview, resend, regenerate
- **Logs**: Sync logs, report generation logs, email delivery logs, integration errors
- **Settings**: Global defaults, branding config, user management (Owner only)

## 4. Client Management
- Full client profiles: name, company, position, phone, email, address, website, social handles, notes, active/inactive status, account manager
- Multiple report recipients per client
- Preferred currency, timezone, reporting start date
- Services subscribed to, connected marketing accounts
- Per-client report configuration: which platforms, which metrics, detail level, upsell on/off, comparisons on/off

## 5. Platform Integrations
Each integration connects via OAuth where applicable, stores tokens securely, handles refresh/reconnect:
- **Google Ads** — spend, impressions, clicks, CTR, conversions, CPC, cost per conversion, campaign breakdowns
- **Meta Ads** — spend, impressions, reach, clicks, CTR, conversions, leads, campaign performance
- **Facebook Pages** — followers, growth, page likes, impressions, reach, engagement, top posts
- **Instagram** — followers, growth, reach, impressions, engagement rate, saves, video views, top posts
- **TikTok** — followers, growth, views, engagement, likes, comments, shares, top posts
- **LinkedIn** — followers, growth, impressions, engagement, clicks, top posts

Each connection shows: connected/disconnected status, last sync, last error, reconnect action.

**API Credentials Note**: You'll need to set up developer accounts with Google, Meta, TikTok, and LinkedIn to get API credentials. I'll guide you through each one during implementation — each platform has its own OAuth app setup process.

## 6. Data Sync System
- **Scheduled sync**: Runs on the 5th of each month via Edge Function + pg_cron
- Pulls only the data for the reporting period
- Stores monthly **snapshots** in the database — historical data is never overwritten
- Resilient: if one platform fails, others continue; failures logged clearly
- Per-client, per-platform sync status tracking
- Manual re-sync available from the dashboard

## 7. Metric Configuration
- Platform-level default metric sets (pre-configured sensible defaults)
- Client-level overrides: toggle individual metrics on/off per platform
- Simple vs detailed report mode toggle per client
- Reorderable report sections
- Easy UI to configure — card-based toggles, not complex forms

## 8. PDF Report Generation
Branded PDF generated server-side using reportlab, styled to AMW brand guide:

### Report Sections:
1. **Cover Page** — AMW logo, client company name, report month/year, "Monthly Marketing Performance Report"
2. **Executive Summary** — AI-generated plain-English summary of highlights, biggest changes, strong/weak areas
3. **Performance Overview** — Key headline KPIs with visual up/down/stable indicators, month-over-month and year-over-year comparisons
4. **Platform Sections** (one per enabled platform) — Selected metrics with charts, trend visuals, AI-generated explanations in plain English, comparisons
5. **Top Content / Campaigns** — Best performing posts/campaigns/creatives (where data available, omitted gracefully if not)
6. **Insights & Explanations** — AI-generated section explaining what changed, what it means, and why the client should care — written in simple, non-technical language
7. **Comparisons** — Month-over-month and year-over-year with graceful fallback if historical data isn't available yet
8. **Upsell Section** (optional, toggle per client) — AI-generated recommendations for relevant AMW services based on the client's data gaps/opportunities
9. **Closing Page** — AMW branding, thank you message, contact details

### Design:
- Charts styled in AMW brand colors (Purple primary, Blue/Green/Orange for series)
- Anton headings, Montserrat body text
- Clean spacing, premium feel, easy to scan
- Non-technical language throughout

## 9. AI-Powered Insights
- Uses Lovable AI to generate plain-English summaries and insights
- Fed the client's current and historical data, generates:
  - Executive summary text
  - Per-platform explanations
  - Overall insights section
  - Upsell recommendations (when enabled)
- Tone: professional, clear, non-technical, client-friendly

## 10. Email Automation
- **Auto-send**: 6th of each month at 10:00 AM via pg_cron + Edge Function
- Branded email template matching AMW style
- PDF attached to email
- Personalised with client/company name and report month
- Supports multiple recipients per client
- Delivery logging (success/failure)
- Manual resend and test email capabilities from dashboard

### Monthly Automation Flow:
1. **5th**: Auto-sync all enabled clients → store snapshots → flag failures
2. **6th at 10:00 AM**: Generate PDFs → send branded emails → log delivery

## 11. Error Handling
- Per-client, per-platform failure isolation (one failure doesn't block others)
- Clear status indicators in dashboard: ✅ success, ⚠️ warning, ❌ failed
- Detailed error logs with timestamps
- Fix-and-retry workflow for individual clients/platforms
- Graceful fallbacks in reports for missing data

## 12. Database Schema (Key Tables)
- `profiles` — AMW team user profiles
- `user_roles` — Owner/Manager roles
- `clients` — Full client records
- `client_recipients` — Multiple email recipients per client
- `platform_connections` — OAuth tokens and connection status per client per platform
- `client_platform_config` — Which platforms/metrics enabled per client
- `metric_defaults` — Platform-level default metric sets
- `monthly_snapshots` — Stored data snapshots per client per month (immutable after report generation)
- `reports` — Generated report records with PDF storage reference
- `sync_logs` — Per-client per-platform sync history
- `report_logs` — Report generation history
- `email_logs` — Email delivery history

## 13. Security
- Internal auth only, no public access
- Role-based RLS on all tables
- Secure token storage for platform credentials
- Audit-friendly logging of all actions
- PDFs stored in private Supabase Storage bucket
