

## Analysis: Facebook Organic vs Paid Overlap

You're right to be concerned. The Facebook Page insights API (`page_media_view`) includes **both organic and paid views** in its totals — the 27.7K views in your screenshot includes ad-driven views. When Meta Ads is also synced, the paid impressions/views would indeed be counted twice.

### What we already have

The sync already fetches the `page_media_view` breakdown by `is_from_ads`, splitting into:
- `totalMediaViewsPaid` (views from ads = `true`)
- `totalMediaViewsOrganic` (views not from ads = `false`)

But currently these are stored as separate fields while `impressions` and `reach` still use the **total** (organic + paid combined).

### Fix

**File: `supabase/functions/sync-facebook-page/index.ts`**

Update the `metricsData` output so the primary metrics reflect **organic only**:

- `impressions` → use `totalMediaViewsOrganic` instead of `totalMediaViews`
- `reach` → use `totalMediaViewsOrganic` instead of `totalMediaViews`
- `engagement_rate` → calculate against organic impressions only
- Keep `paid_impressions` and `organic_impressions` as-is for reference
- Keep the total in a separate field (`total_impressions`) if needed for debugging

This ensures:
1. The Facebook Page card shows **organic-only** numbers
2. Meta Ads shows **paid-only** numbers
3. No duplication when both are synced

### Posts filtering

The post fetch (`published_posts`) already only returns **organic posts** — Facebook doesn't return ads through this endpoint. So `top_content` is already clean.

### Files to modify
1. `supabase/functions/sync-facebook-page/index.ts` — switch primary metrics to organic-only values

