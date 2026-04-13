

## Plan: Google Ads Campaign/Ad Group/Ad Breakdown

### Goal
Add the same 3-tab hierarchical breakdown (Campaigns, Ad Groups, Ads) to Google Ads, matching what was built for Meta Ads. This requires backend changes to fetch ad group and ad-level data, and frontend changes to render the breakdown.

### Backend — `supabase/functions/sync-google-ads/index.ts`

Currently only fetches campaign-level data. Add two new GAQL queries after the existing campaign query:

1. **Ad Group query** — Fetch ad group performance:
   ```sql
   SELECT ad_group.name, ad_group.id, ad_group.status,
          campaign.name, campaign.id,
          metrics.impressions, metrics.clicks, metrics.cost_micros,
          metrics.conversions, metrics.ctr, metrics.average_cpc
   FROM ad_group
   WHERE segments.date BETWEEN ... AND ...
     AND campaign.status != 'REMOVED'
   ORDER BY metrics.cost_micros DESC
   ```

2. **Ad query** — Fetch individual ad performance with creative info:
   ```sql
   SELECT ad_group_ad.ad.id, ad_group_ad.ad.name,
          ad_group_ad.ad.type, ad_group_ad.status,
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_display_ad.marketing_images,
          ad_group.name, ad_group.id,
          campaign.name, campaign.id,
          metrics.impressions, metrics.clicks, metrics.cost_micros,
          metrics.conversions, metrics.ctr, metrics.average_cpc
   FROM ad_group_ad
   WHERE segments.date BETWEEN ... AND ...
     AND campaign.status != 'REMOVED'
     AND ad_group_ad.status != 'REMOVED'
   ORDER BY metrics.cost_micros DESC
   ```

3. **Store in `raw_data`**: Extend the existing `rawData` object to include `adGroups` and `ads` arrays alongside the existing `campaigns`, `geoBreakdown`, `deviceBreakdown`.

4. **Map status**: Google Ads uses `ENABLED`, `PAUSED`, `REMOVED` — map to the same badge system.

5. **Timeout safety**: Add a 50-second deadline. If time runs short, skip the ad-level query.

### Frontend — `PlatformSection.tsx`

Add the `AdCampaignBreakdown` component for `google_ads` platform, same as `meta_ads`. The existing component already handles the 3-tab layout generically.

Around line 642, after the Meta Ads block, add:
```tsx
{platform === 'google_ads' && rawData && (rawData.campaigns as any[])?.length > 0 && (
  <AdCampaignBreakdown rawData={rawData as any} currSymbol={currSymbol} />
)}
```

### Frontend — `AdCampaignBreakdown.tsx`

Minor adjustments to handle Google Ads field naming differences:
- Google Ads uses `spend` (already converted from `cost_micros`) vs Meta's `spend` — same field name, no change needed.
- Google uses `avg_cpc` instead of `cpc` — normalize in the mapping.
- Google uses `ad_group` terminology instead of `ad_set` — the "Ad Sets" tab label should dynamically show "Ad Groups" for Google Ads. Add an optional `adGroupLabel` prop or detect from data shape.
- Google Ads creatives differ: responsive search ads have headlines/descriptions text, responsive display ads have image assets. The AdCard component should handle text-only creatives gracefully (already shows placeholder when no image).

### Files to Change
1. `supabase/functions/sync-google-ads/index.ts` — add ad group + ad-level GAQL queries, store in raw_data
2. `src/components/clients/dashboard/AdCampaignBreakdown.tsx` — add `platformType` prop to switch "Ad Sets" label to "Ad Groups"
3. `src/components/clients/dashboard/PlatformSection.tsx` — wire up AdCampaignBreakdown for `google_ads`

### No Database Changes
All data fits in existing `raw_data` JSONB column.

