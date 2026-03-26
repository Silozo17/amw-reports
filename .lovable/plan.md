
Root cause is confirmed: the Meta Ads widget is rendering exactly what is stored in the snapshot, and the latest snapshot for this client still contains the old metric shape.

What I found:
- Latest `monthly_snapshots` row for this client/platform still has:
  - `conversions`
  - `cost_per_conversion`
  - `conversions_value`
  - `roas`
  - `ctr: 0.0135...`
- It does not have:
  - `leads`
  - `cost_per_lead`
- That means the sync data in the database was written by the old Meta Ads sync output, so the UI has nothing to display for leads/CPL.
- This is not caused by client metric filtering for this client:
  - there is no `client_platform_config` row for this client’s `meta_ads`
- I also found stale global defaults in the database:
  - `metric_defaults` for `meta_ads` still lists old available metrics like `conversions`, `cost_per_conversion`, `roas`
- There are still some old frontend references to conversion-based metrics in a few files, so even after the backend is corrected, parts of the app can still show outdated language/formatting elsewhere.

Plan:
1. Fix the backend/data mismatch first
   - Reconcile the running `sync-meta-ads` backend so it definitely writes:
     - `leads`
     - `cost_per_lead`
     - `ctr` as a real percentage
   - Then re-sync the affected Meta Ads months so existing snapshots are rewritten with the new keys.
   - This is the main fix, because the current widget is reading old stored data.

2. Clean up stale metric configuration data
   - Update `metric_defaults` for `meta_ads` so available/default metrics match the new Meta Ads model.
   - Remove old Meta Ads defaults like:
     - `conversions`
     - `cost_per_conversion`
     - `conversions_value`
     - `roas`
   - Ensure `leads` and `cost_per_lead` are included by default.
   - Also sweep existing `client_platform_config` rows for `meta_ads` so older saved configs do not keep hiding the new metrics for other clients.

3. Finish the frontend cleanup
   - Audit remaining conversion-specific references so Meta Ads is consistently lead-based everywhere it appears.
   - Files to update:
     - `src/components/clients/ClientDashboard.tsx`
       - remove Meta-specific dependence on `conversions` / `cost_per_conversion` in aggregate logic where needed
     - `src/components/clients/PlatformMetricsCard.tsx`
       - treat `cost_per_lead` as a cost metric for formatting and change-color logic
     - `src/pages/ClientPortal.tsx`
       - replace remaining cost/conversion label handling so portal view stays consistent
     - `src/types/metrics.ts`
       - add/update explanation text for `cost_per_lead` and keep Meta terminology aligned

4. Verify Meta Ads end-to-end
   - Re-sync the current month for this client
   - Confirm the Meta Ads section shows:
     - Leads
     - Cost Per Lead
     - CTR as a percentage, not a near-zero decimal
   - Confirm “Conversions” is no longer shown for Meta Ads
   - Confirm Settings metric defaults for Meta Ads no longer expose old conversion metrics

Technical notes:
- The strongest evidence is the stored row itself: if the new sync code had run successfully, the snapshot would already contain `leads` and `cost_per_lead`, and CTR would be around `1.35`, not `0.0135`.
- So the immediate problem is not the widget component; it is stale backend-written snapshot data plus stale defaults/configuration.
