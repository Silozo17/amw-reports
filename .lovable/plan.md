

# Admin Sync Progress Bar + Enriched Platform Data

## 1. Admin Sync Dialog — Background Progress Bar

**Problem**: The admin sync runs in a blocking modal with just a text spinner. It should close the dialog and show a SyncProgressBar like the dashboard does when connecting accounts.

**Fix**: Refactor `AdminSyncDialog` to use `triggerInitialSync` from `src/lib/triggerSync.ts` and expose the `activeSyncs` Map + `startTime` state upward so the parent (`AdminOrgClients`) can render the existing `SyncProgressBar` component. The dialog closes immediately after starting, and sync runs in the background with real-time progress.

**Files**: `src/components/admin/AdminSyncDialog.tsx`, `src/components/admin/AdminOrgClients.tsx`

---

## 2. GSC — Add Countries & Devices

**Problem**: Currently only fetches aggregate metrics + top queries + top pages. The GSC Search Analytics API supports `country` and `device` dimensions but we're not using them.

**Fix**: Add two additional API calls in `sync-google-search-console/index.ts`:
- **Country breakdown**: `dimensions: ["country"]`, `rowLimit: 30`, ordered by clicks — stored as `topCountries` in `raw_data`
- **Device breakdown**: `dimensions: ["device"]`, `rowLimit: 5`, ordered by clicks — stored as `topDevices` in `raw_data`

Both added to `top_content` array with `type: "country"` and `type: "device"` for consistency with existing pattern.

**File**: `supabase/functions/sync-google-search-console/index.ts`

---

## 3. Google Ads — Geographic Breakdown

**Problem**: Only fetches campaign-level data. Google Ads API supports geographic segmentation via `geographic_view`.

**Fix**: Add a second GAQL query in `sync-google-ads/index.ts`:
```sql
SELECT
  geographic_view.country_criterion_id,
  geographic_view.resource_name,
  metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
FROM geographic_view
WHERE segments.date BETWEEN ... AND ...
ORDER BY metrics.cost_micros DESC
LIMIT 30
```
Parse results and store as `geoBreakdown` in `raw_data`. Also add to `top_content` with `type: "geo"`.

**File**: `supabase/functions/sync-google-ads/index.ts`

---

## 4. Platform Data Audit — Missing Data Summary

After reviewing all 12 sync functions, here's what's currently **missing** that the APIs provide:

| Platform | Missing Data | API Available? | Priority |
|---|---|---|---|
| **Google Ads** | Geographic breakdown, Device breakdown | Yes (geographic_view, segments.device) | High |
| **GSC** | Countries, Devices | Yes (dimensions) | High |
| **Meta Ads** | Age/gender breakdown, Country breakdown, Placement breakdown | Yes (breakdowns param) | Medium |
| **YouTube** | Geographic breakdown, Traffic sources, Device types | Yes (Analytics dimensions) | Medium |
| **TikTok Ads** | Age/gender breakdown, Country breakdown | Yes (report dimensions) | Medium |
| **LinkedIn** | Page views/unique visitors, Follower demographics | Yes (org page stats) | Low |
| **Pinterest** | Top individual pins analytics | Yes (pins endpoint) | Low |
| **GBP** | Photo views | Yes (PHOTOS_VIEWS metrics) | Low |
| **Facebook** | Already comprehensive | — | — |
| **Instagram** | Already comprehensive | — | — |
| **TikTok Organic** | Limited by Login Kit API | No more available | — |
| **GA4** | Already the gold standard | — | — |

**This plan implements**: Google Ads geo, GSC countries + devices (High priority). The Medium/Low items can be tackled in follow-up iterations.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/admin/AdminSyncDialog.tsx` | Refactor to use `triggerInitialSync`, expose progress state, close dialog on start |
| `src/components/admin/AdminOrgClients.tsx` | Accept and render `SyncProgressBar` from admin sync state |
| `supabase/functions/sync-google-search-console/index.ts` | Add country + device dimension queries |
| `supabase/functions/sync-google-ads/index.ts` | Add geographic_view query |

