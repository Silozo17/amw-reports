

## Plan: LinkedIn Ads Campaign/Ad Group Breakdown

### Goal
Add the same 3-tab hierarchical breakdown to LinkedIn Ads, matching Meta Ads and Google Ads. LinkedIn doesn't have "ad sets" — it uses **Campaign Groups** (parent) and **Campaigns** (child), but the current sync already pivots by CAMPAIGN. We'll add a **CREATIVE** pivot to get individual ad-level data.

### Backend — `supabase/functions/sync-linkedin-ads/index.ts`

LinkedIn Ads API uses the AdAnalytics endpoint with different `pivot` values. Currently fetches `ACCOUNT` and `CAMPAIGN` pivots.

1. **Add CREATIVE pivot** — Fetch ad-level (creative) analytics:
   - New call: `buildAnalyticsUrl("CREATIVE", ...)` with same fields
   - Each element's `pivotValues[0]` will be `urn:li:sponsoredCreative:{id}`
   - Parse creative ID, fetch spend/clicks/impressions/conversions per creative

2. **Fetch campaign details** — Already done (name lookup). Add `status` and `type` fields from the `/adCampaigns/{id}` response (fields: `name`, `status`, `type`, `campaignGroup`).

3. **Fetch Campaign Group details** — For each unique `campaignGroup` URN from campaigns, fetch name/status from `/adCampaignGroups/{id}`. These become the "Campaign Groups" tab (equivalent to "Campaigns" in the UI hierarchy).

4. **Fetch creative metadata** — For each creative ID, call `GET /adCreatives/{id}` to get:
   - `status` (ACTIVE, PAUSED, DRAFT, ARCHIVED)
   - `campaign` URN (to link back)
   - `reference` (the social post URN for content)
   - Creative content if available

5. **Store in `raw_data`**:
   ```json
   {
     "campaignGroups": [{ id, name, status, spend, clicks, impressions, ... }],
     "campaigns": [{ id, name, status, campaignGroupId, spend, clicks, ... }],
     "ads": [{ id, name, status, campaignId, spend, clicks, ctr, cpc, ... }]
   }
   ```

6. **Timeout safety**: Add 50-second deadline. Skip creative metadata fetch if running low.

### Frontend — `PlatformSection.tsx`

Add LinkedIn Ads block after Google Ads (~line 657):
```tsx
{platform === 'linkedin_ads' && rawData && (rawData.campaigns as any[])?.length > 0 && (
  <AdCampaignBreakdown
    rawData={{
      campaigns: rawData.campaignGroups || [],
      adSets: rawData.campaigns || [],
      ads: rawData.ads || [],
    }}
    currSymbol={currSymbol}
    adGroupLabel="Campaigns"
  />
)}
```

LinkedIn's hierarchy: Campaign Groups → Campaigns → Creatives. We map:
- "Campaigns" tab → Campaign Groups
- "Ad Sets/Ad Groups" tab → Campaigns (with label "Campaigns")
- "Ads" tab → Creatives

### Frontend — `AdCampaignBreakdown.tsx`

No structural changes needed. The existing `adGroupLabel` prop handles the dynamic tab label. LinkedIn statuses (`ACTIVE`, `PAUSED`, `ARCHIVED`, `DRAFT`) are already covered or trivially added to `STATUS_COLORS`.

Add `DRAFT` to the status colors map.

### Files to Change
1. `supabase/functions/sync-linkedin-ads/index.ts` — add CREATIVE pivot, campaign group lookups, creative metadata, store hierarchical raw_data
2. `src/components/clients/dashboard/AdCampaignBreakdown.tsx` — add DRAFT status color
3. `src/components/clients/dashboard/PlatformSection.tsx` — wire up AdCampaignBreakdown for `linkedin_ads`

### No Database Changes
All data fits in existing `raw_data` JSONB column.

