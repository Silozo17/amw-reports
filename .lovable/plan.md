

## Google Platform Audit: AMW Media

### Current Status of Each Platform

**1. Google Ads** — Working
- Connected, synced, has 12 months of snapshot data
- Oct 2025 has real data (£112 spend, 35 clicks, 809 impressions, 5 conversions)
- All other months show zeros (no ad spend those months)
- Metrics captured: spend, impressions, clicks, ctr, cpc, cpm, conversions, conversion_rate, conversions_value, cost_per_conversion, roas, reach, search_impression_share, campaign_count
- Dashboard displays correctly via PlatformMetricsCard

**2. Google Search Console (GSC)** — Connected but never synced
- Connected with `account_id: sc-domain:amwmedia.co.uk`, `is_connected: true`
- `last_sync_status: null` — no sync has ever run
- Zero monthly snapshots exist
- Metrics it would capture: search_clicks, search_impressions, search_ctr, search_position
- Top content: top queries + top pages
- All metric labels and explanations exist in the codebase

**3. Google Analytics (GA4)** — Connected but never synced
- Connected with `account_id: 450772625`, `account_name: AMW Media Ltd`, `is_connected: true`
- `last_sync_status: null` — no sync has ever run
- Zero monthly snapshots exist
- Metrics it would capture: sessions, active_users, new_users, ga_page_views, bounce_rate, avg_session_duration, pages_per_session
- Top content: top pages + traffic sources
- All metric labels and explanations exist in the codebase

**4. Google Business Profile (GBP)** — Error: API quota = 0
- `is_connected: false`, has `discovery_error`
- Error: `Quota exceeded for quota metric 'Requests'... quota_limit_value: "0"` for `mybusinessaccountmanagement.googleapis.com`
- This means the **My Business Account Management API** is enabled but has a **quota of 0 requests/min**. This is a Google Cloud project quota issue — the API needs a quota increase request or the project needs to be verified/approved for GBP API access.
- Metrics it would capture: gbp_views, gbp_searches, gbp_calls, gbp_direction_requests, gbp_website_clicks, gbp_reviews_count, gbp_average_rating

**5. YouTube** — Connected but never synced
- Connected with `account_id: UCD-iiWevZtUW1FzJDJ9n_Uw`, `account_name: AMW Media`, `is_connected: true`
- `last_sync_status: null` — no sync has ever run
- Zero monthly snapshots exist
- Metrics it would capture: views, watch_time, likes, comments, shares, subscribers, impressions, ctr, avg_view_duration, total_followers, video_views, videos_published
- Top content: top 5 videos with titles

### Issues Found

**Issue A: GSC, GA4, and YouTube have no data because they've never been synced**
- No code bug — they just need the user to trigger a sync (manual or bulk) from the Connections tab
- This is expected behavior

**Issue B: GBP has a quota_limit_value of "0"**
- The My Business Account Management API in Google Cloud project `369224852796` has a default quota of **zero** requests per minute
- This is a Google Cloud Console configuration issue — you need to either:
  1. Request a quota increase in the Google Cloud Console for the My Business Account Management API
  2. Or ensure the Google Cloud project has completed any required verification for GBP API access
- No code change needed for this

**Issue C: Dashboard KPI cards don't surface GSC/GA4/GBP/YouTube metrics in the hero section**
- The hero KPI cards only aggregate: spend, reach/impressions, clicks, engagement, followers, link_clicks, page_views, video_views
- GSC metrics use different keys (`search_clicks`, `search_impressions`) that don't map to the hero KPI aggregation
- GA4 uses `sessions`, `active_users`, `ga_page_views` — only `ga_page_views` would show (under "Page Views" KPI) but GA uses different key names
- YouTube `views` would not appear in reach (which looks for `reach` or `impressions`)
- GBP metrics (`gbp_views`, `gbp_calls`, etc.) don't feed into any hero KPI

**Issue D: Top content table only works for social posts format**
- The "Performance by Post" table expects `message/caption`, `full_picture`, `permalink_url`, `total_engagement`, `reach` fields
- GSC top content uses `query/page`, `clicks`, `impressions` — won't render meaningfully
- GA4 top content uses `page/source`, `views/sessions` — won't render
- YouTube top content uses `title`, `views`, `likes`, `comments` — won't render
- These platforms need dedicated top content sections

### Proposed Changes

**1. Fix hero KPI aggregation to include Google platform metrics**
- `src/components/clients/ClientDashboard.tsx`:
  - Add YouTube `views` and GBP `gbp_views` to reach/impressions total
  - Add GSC `search_clicks` and GBP `gbp_website_clicks` to clicks total  
  - Add GA4 `sessions` as a dedicated KPI when GA4 data exists
  - Add YouTube engagement (likes + comments + shares) to engagement total

**2. Add dedicated top content sections for non-social platforms**
- `src/components/clients/ClientDashboard.tsx`:
  - Add a "Top Search Queries" table for GSC data (query, clicks, impressions, CTR, position)
  - Add a "Top Pages" table for GA4 data (page path, views, users)
  - Add a "Top Videos" table for YouTube data (title, views, likes, comments)
  - These render alongside the existing "Performance by Post" section

**3. No code fix for GBP — document the quota issue**
- The GBP error is a Google Cloud project configuration issue
- You need to go to Google Cloud Console → APIs & Services → My Business Account Management API → Quotas, and request a quota increase from 0 to at least 60 requests/min
- Alternatively, check if the project needs to complete OAuth consent screen verification for Business Profile API access

### Technical Details

Files to modify:
- `src/components/clients/ClientDashboard.tsx` — hero KPI aggregation + new top content sections
- No edge function changes needed — sync functions are correctly implemented
- No database changes needed

The PlatformMetricsCard already handles all metric keys correctly — once data is synced, platform detail cards will display all GSC/GA4/GBP/YouTube metrics automatically.

