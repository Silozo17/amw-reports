

## Add Leads Column to Ad Cards

### Problem
The `AdCard` component in the Ads tab of Campaign Breakdown shows Spend, Clicks, CTR, CPC, Impressions, and Reach — but not Leads. The `AdItem` interface already includes a `leads` field, and both the Campaigns and Ad Sets tables display it. It's just missing from the card UI.

### Changes

**File: `src/components/clients/dashboard/AdCampaignBreakdown.tsx`**

1. Add a Leads row to the `AdCard` metric grid (after the Reach row), showing the lead count when > 0, or "—" when zero. This matches the pattern used in the Campaigns and Ad Sets tables.

```tsx
<div className="flex justify-between">
  <span className="text-muted-foreground">Leads</span>
  <span className="tabular-nums font-medium">
    {safe(ad.leads) > 0 ? fmtNum(ad.leads) : '—'}
  </span>
</div>
```

That's it — single addition, no other files affected.

