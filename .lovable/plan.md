

## Reorder Hero KPIs with Fixed Priority List

### Changes

**File: `src/lib/dashboardCalcs.ts`**

1. **Fix Clicks calculation** — Remove `website_clicks`, `gbp_website_clicks`, and `link_clicks` from the `totalClicks` / `prevClicks` / `clicksPlatforms` aggregation. Clicks should only include `clicks`, `search_clicks`, and `post_clicks`.

2. **Bring back Website Clicks** — Already computed as `totalWebsiteClicks`. Just needs to be in the return array.

3. **Reorder the return array** to match the requested priority:

| # | KPI | Notes |
|---|---|---|
| 1 | Total Spend | No change |
| 2 | Video Views | No change |
| 3 | Reach | No change |
| 4 | Clicks | Exclude website clicks and link clicks |
| 5 | Engagement | No change |
| 6 | Followers | No change |
| 7 | Posts Published | Move up |
| 8 | Avg. Rating | Move up |
| 9 | Leads | Move up |
| 10 | Page Views | Move up |
| 11 | Phone Calls | Move up |
| 12 | Website Clicks | Bring back |

4. **Demote to overflow** (position 13+, only shown if any above are empty): Sessions, Search Impressions, Conversions, Direction Requests. Remove Search CTR and Avg Position entirely (covered by Search Performance trend section).

5. **Add sparklines** for `website_clicks` and `page_views` (currently missing from sparkline computation). Remove `search_clicks` sparkline key (no longer a separate KPI).

