

# Add Cost Per Lead to Campaign Breakdown

## What It Does
Adds a "Cost Per Lead" (CPL) column/metric to all three levels of the Campaign Breakdown: Campaigns table, Ad Sets table, and Ad Cards. CPL is calculated as `spend / leads` (shows "—" when leads is 0).

## Changes

### `src/components/clients/dashboard/AdCampaignBreakdown.tsx`

1. **Add `fmtCPL` helper**: A small function that returns `currSymbol + (spend / leads)` formatted to 2 decimal places, or `'—'` when leads is 0.

2. **CampaignsTable**: Add a `Cost/Lead` column header after the existing `Leads` column. Each row displays `fmtCPL(c.spend, c.leads, currSymbol)`. Update `colSpan` on the empty-state row from 9 to 10.

3. **AdSetsTable**: Same — add `Cost/Lead` column after `Leads`. Update `colSpan` from 9 to 10.

4. **AdCard**: Add a `Cost/Lead` row in the 2-column grid (after the existing Leads row), displaying the calculated CPL value.

No backend changes, no new types, no other files affected. The `leads` and `spend` fields already exist on all three interfaces (`CampaignItem`, `AdSetItem`, `AdItem`).

