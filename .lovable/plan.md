

## Plan: Redesign Meta Ads Breakdown with 3-Tab Layout and Creative Cards

### Problem
The current `AdCampaignBreakdown` component uses a nested drill-down table. The user wants a layout matching Meta Ads Manager: three separate tabs (Campaigns, Ad Sets, Ads), with the Ads tab showing visual cards with creative images and metrics — not inline table rows.

Additionally, status shows "NaN" because some campaigns/ads have no status match in the status map, and the `StatusBadge` component does not handle missing values gracefully.

### Changes

**1. Rewrite `src/components/clients/dashboard/AdCampaignBreakdown.tsx`**

Replace the nested collapsible table with a tabbed layout using shadcn `Tabs`:

- **Tab 1: Campaigns** — Table with columns: Campaign name, Status badge, Objective, Spend, Impressions, Clicks, CTR, CPC, Leads. Sorted by spend. Filter toggle for Active/All.
- **Tab 2: Ad Sets** — Table with columns: Ad Set name, Campaign name, Status, Spend, Impressions, Clicks, CTR, CPC, Leads. Clicking a campaign name in the Campaigns tab could filter ad sets (stretch).
- **Tab 3: Ads** — Card grid (not table). Each card shows:
  - Creative thumbnail image (large, like the reference screenshot)
  - Ad name
  - Status badge
  - Key metrics: Spend, CTR, CPC, Clicks
  - Ad copy snippet (body text)

The Ads tab card layout will match the reference image: large image at top, ad name below, then metric rows.

- Fix `StatusBadge` to handle undefined/null/empty status gracefully (show "Unknown" with neutral styling).
- Fix NaN display by defaulting `ctr`/`cpc` to 0 when parsing and guarding `fmtPct`/`fmtCurrency` against NaN.

**2. Update `src/components/clients/dashboard/PlatformSection.tsx`**

No structural changes needed — it already passes `rawData` and `currSymbol` to `AdCampaignBreakdown`. The component swap is internal.

**3. Backend — No changes needed**

The sync function already fetches campaigns, ad sets, ads, creatives, and statuses. The data structure in `raw_data` already has everything needed. If creative thumbnails are missing for some ads, the UI will show a placeholder.

### Files to change
1. `src/components/clients/dashboard/AdCampaignBreakdown.tsx` — full rewrite with tabs + card grid for ads

### Technical details
- Uses shadcn `Tabs` component (already in project)
- Ads card grid: responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Creative images displayed at ~200px height with `object-cover`
- Filter bar (Active/All) persists across all three tabs
- Tab headers show counts: "Campaigns (5)", "Ad Sets (12)", "Ads (24)"

