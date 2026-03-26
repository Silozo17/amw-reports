

# Meta Ads: Leads, Cost Per Lead, CTR Fix & Audit

## Summary

Four issues to address in the Meta Ads sync function and frontend:

1. **Replace "Conversions" with "Leads"** — extract lead actions from Meta API instead of purchase actions
2. **Rename "Cost Per Conversion" → "Cost Per Lead"** — store as `cost_per_lead` instead of `cost_per_conversion`
3. **CTR shows 0%** — stored as decimal ratio (0.015) but displayed with `.toFixed(1)%` → shows "0.0%". Needs `× 100`
4. **Audit remaining fields** — all other fields are correctly mapped

---

## Technical Details

### File 1: `supabase/functions/sync-meta-ads/index.ts`

**A. Extract leads instead of purchases (lines 149–169)**

Replace the conversion extraction logic. Instead of matching `purchase`/`omni_purchase` action types, match lead action types from Meta's `actions` array:
- `lead`
- `onsite_conversion.lead_grouped`
- `offsite_conversion.fb_pixel_lead`
- `onsite_web_lead`

Rename variables: `conversions` → `leads`, `conversionsValue` → remove (leads don't have monetary value like purchases).

**B. Fix CTR calculation (line 204)**

Change from:
```ts
const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
```
To:
```ts
const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
```

**C. Update metricsData object (lines 210–226)**

- Replace `conversions` → `leads` (total leads count)
- Remove `conversions_value` (not relevant for leads)
- Replace `cost_per_conversion` → `cost_per_lead` (spend / leads)
- Remove `roas` (not meaningful for lead-based campaigns)
- CTR is already fixed by step B

Updated metricsData shape:
```ts
{
  impressions, clicks, spend,
  leads: totalLeads,
  ctr: overallCtr,  // now × 100
  cpc: overallCpc,
  cpm: overallCpm,
  cost_per_lead: totalLeads > 0 ? totalSpend / totalLeads : 0,
  reach, link_clicks, frequency, video_views, campaign_count,
}
```

**D. Update campaign objects and topContent** — replace `conversions` with `leads` in campaign-level data too.

### File 2: `src/types/database.ts`

**A. Add `cost_per_lead` to METRIC_LABELS** (~line 262):
```ts
cost_per_lead: 'Cost Per Lead',
```

**B. Update `PLATFORM_AVAILABLE_METRICS.meta_ads`** (line 345–349):
- Remove `conversions`, `conversions_value`, `conversion_rate`, `cost_per_conversion`, `roas`
- Add `cost_per_lead`
- Keep `leads` (already present)

Result:
```ts
meta_ads: [
  'spend', 'impressions', 'reach', 'clicks', 'link_clicks', 'ctr',
  'leads', 'cpc', 'cpm', 'cost_per_lead', 'frequency',
],
```

**C. Add `cost_per_lead` to `AD_METRICS` set** (line 240) so it's hidden on organic platforms.

### File 3: `src/components/clients/dashboard/PlatformSection.tsx`

**A. Update `AD_PLATFORM_KEY_METRICS`** (line 78) — this is the priority display order for ad platforms. Replace `conversions` and `cost_per_conversion` with `leads` and `cost_per_lead`.

But this array is shared between `google_ads` and `meta_ads`. Since Google Ads still uses conversions, create a separate array for Meta Ads:
```ts
const META_ADS_KEY_METRICS = ['impressions', 'clicks', 'ctr', 'spend', 'cpc', 'leads', 'cost_per_lead', 'reach'];
```

Update `PLATFORM_KEY_METRICS` to use it:
```ts
meta_ads: META_ADS_KEY_METRICS,
```

**B. Add `cost_per_lead` to `COST_METRICS` set** (line 99) so it formats with currency symbol.

### File 4: `src/components/clients/MetricConfigPanel.tsx` — No changes needed (it reads from `PLATFORM_AVAILABLE_METRICS` dynamically).

---

## What's already correct (audit)

- **Impressions, clicks, spend** — correctly mapped from API fields
- **Reach** — correctly pulled from API
- **Link clicks** — correctly extracted from `actions` array (`link_click` / `outbound_click`)
- **CPC, CPM** — correctly calculated from totals
- **Frequency** — correctly calculated as impressions/reach
- **Video views** — correctly extracted from `video_play_actions`
- **Campaign count** — correct

## Note on CTR

The same CTR bug exists in `sync-google-ads` (line 248), but the user only asked about Meta Ads. Will not touch Google Ads unless requested.

