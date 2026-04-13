

## Plan: Meta Ads Campaign/Ad Set/Ad Breakdown with Creatives

### Goal
Expand the Meta Ads sync to pull campaign, ad set, and ad-level data including creatives (thumbnail images, ad copy, preview URLs), and display it in collapsible drill-down tables within the existing Meta Ads dashboard section. Users can filter by active vs inactive status.

### Current State
- `sync-meta-ads` only fetches **campaign-level** insights using `level: "campaign"`.
- Dashboard shows top 10 campaigns by spend in the "Top Content" collapsible, but only name/spend/clicks — no ad sets, no individual ads, no creatives.
- Data is stored in `monthly_snapshots.raw_data` (JSON) and `top_content` (JSON array).

### Backend Changes — `supabase/functions/sync-meta-ads/index.ts`

**Add 3 new API calls** after the existing campaign insights fetch:

1. **Ad Set Insights** — `GET /{ad_account_id}/insights?level=adset`
   - Fields: `adset_name, adset_id, campaign_name, campaign_id, impressions, clicks, spend, actions, ctr, cpc, cpm, reach`
   - Same `time_range` as campaigns

2. **Ad-Level Insights** — `GET /{ad_account_id}/insights?level=ad`
   - Fields: `ad_name, ad_id, adset_name, adset_id, campaign_name, campaign_id, impressions, clicks, spend, actions, ctr, cpc, cpm, reach`
   - Same `time_range`

3. **Ad Creatives** — For each unique ad, fetch creative data:
   - `GET /{ad_id}?fields=creative{thumbnail_url,effective_object_story_id,object_story_spec,asset_feed_spec,title,body,image_url,video_id}`
   - Batch into groups of 50 using Facebook Batch API to avoid rate limits
   - Store thumbnail URL, ad copy (title/body), and preview link per ad

4. **Campaign/Ad Set/Ad Status** — Fetch active vs paused/archived status:
   - `GET /{ad_account_id}/campaigns?fields=id,name,status,objective&limit=500`
   - `GET /{ad_account_id}/adsets?fields=id,name,status,campaign_id&limit=500`
   - `GET /{ad_account_id}/ads?fields=id,name,status,adset_id,creative{id}&limit=500`

**Store in `raw_data`:**
```json
{
  "campaigns": [...],
  "adSets": [...],
  "ads": [...],
  "creatives": { "<ad_id>": { "thumbnail_url": "...", "title": "...", "body": "..." } }
}
```

**Timeout safety:** Add a 50-second deadline check (matching the pattern from Facebook/Instagram sync). If time runs short, skip creative fetching and save what we have.

### Frontend Changes

**File: `src/components/clients/dashboard/PlatformSection.tsx`**

Add a new collapsible section for Meta Ads (and later Google Ads) that renders:

1. **Campaign Table** — collapsible, shows all campaigns with status badge (Active/Paused/Archived), spend, clicks, impressions, CTR, CPC, conversions. Filter toggle: Active / All.

2. **Drill-down: Ad Sets per Campaign** — clicking a campaign row expands to show its ad sets with the same metrics.

3. **Drill-down: Ads per Ad Set** — clicking an ad set row expands to show individual ads with:
   - Thumbnail image (from creative)
   - Ad name + copy snippet
   - Status badge
   - Spend, clicks, impressions, CTR
   - Link to view on Facebook (if available)

4. **Filter bar** — simple toggle between "Active" and "All" statuses, applied across the hierarchy.

**New component file: `src/components/clients/dashboard/AdCampaignBreakdown.tsx`**
- Keeps PlatformSection from growing too large
- Receives `rawData` prop containing campaigns, adSets, ads, creatives
- Handles the hierarchical expand/collapse and filtering logic
- Reuses existing UI components (Table, Badge, Collapsible)

### Technical Details

- Meta Graph API `level` parameter handles deduplication automatically — no risk of double-counting
- Creative thumbnails: request at `thumbnail_width=200` for display quality
- Status values from Meta: `ACTIVE`, `PAUSED`, `ARCHIVED`, `DELETED` — map to badges
- Edge function timeout: batch creative fetches and cap total processing at 50s
- No database schema changes — all data fits in existing `raw_data` JSONB column

### Files to Change
1. `supabase/functions/sync-meta-ads/index.ts` — add ad set, ad, creative, and status fetches
2. `src/components/clients/dashboard/AdCampaignBreakdown.tsx` — new component for hierarchical ad tables
3. `src/components/clients/dashboard/PlatformSection.tsx` — wire up AdCampaignBreakdown for `meta_ads` platform
4. `src/types/database.ts` — add TopContentItem fields for ad-level data if needed

### What This Does NOT Include (deferred to next pass)
- Google Ads equivalent (will follow same pattern after Meta Ads is confirmed working)
- Video creative previews (thumbnails only for now)
- Editing ads from the dashboard

