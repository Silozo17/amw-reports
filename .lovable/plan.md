

# Add Platform Logos to Hero KPI Cards

## Problem
Users can't tell which platforms contribute to each aggregated KPI (e.g. "Reach" combines Facebook reach, Instagram reach, GA views, etc.). The screenshot confirms the cards show only a generic icon and label.

## Solution
Add small platform logo icons to each Hero KPI card, showing which platforms contributed data to that metric. The logos appear as a row of tiny avatars (16x16px) beneath the metric label.

## How it works

Each KPI already aggregates from `filtered` snapshots. We need to track **which platforms** contributed a non-zero value for each metric, then pass that list to the card.

### 1. `src/components/clients/ClientDashboard.tsx`
- Extend the `KpiItem` interface to include `platforms: PlatformType[]`
- In the `kpis` useMemo (lines 316-351), for each KPI, compute which platforms from `filtered` snapshots contributed non-zero values to that metric
- Example: for "Reach", loop `filtered` and collect platforms where `reach