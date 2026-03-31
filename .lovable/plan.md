

# Show GSC Top Pages, Countries & Devices on Dashboard

## Problem
The GSC sync function already fetches and stores top pages, countries, and devices in both `top_content` and `raw_data`. But the `PlatformSection` UI component only renders GSC queries — it never shows the pages table, and the geo/device widgets are hard-gated to `platform === 'google_analytics'`.

## Changes

### `src/components/clients/dashboard/PlatformSection.tsx`

**1. Filter GSC-specific content using `type` field**
The `top_content` items from GSC have `type: "query"`, `type: "page"`, `type: "country"`, `type: "device"`. Update filtering:
```ts
const gscQueries = (topContent ?? []).filter(p => (p as any).type === 'query' || (p.query && platform === 'google_search_console'));
const gscPages = (topContent ?? []).filter(p => (p as any).type === 'page' || (p.page && !p.query && platform === 'google_search_console'));
const gscCountries = (topContent ?? []).filter(p => (p as any).type === 'country');
const gscDevices = (topContent ?? []).filter(p => (p as any).type === 'device');
```

**2. Add GSC Top Pages table**
After the existing GSC queries table, render a "Top Pages" table showing page URL, clicks, impressions, CTR.

**3. Expand `hasTopContent` check**
Include `gscPages.length > 0` and update the collapsible label logic.

**4. Render GeoHeatmap and DeviceBreakdown for GSC**
After the top content collapsible, add a GSC-specific block (similar to the GA4 block at line 605) that renders:
- `GeoHeatmap` using `rawData.topCountries` (countries only, no cities for GSC)
- `DeviceBreakdown` using `rawData.topDevices` (no new/returning for GSC)

Both components already exist and accept the right props.

**5. Update `TopContentItem` interface**
Add `type?: string`, `country?: string`, `device?: string` fields.

### No backend changes needed
The sync function already stores all this data correctly.

## Files Changed

| File | Change |
|---|---|
| `src/components/clients/dashboard/PlatformSection.tsx` | Add GSC pages table, wire up geo/device widgets for GSC, update content filters |

