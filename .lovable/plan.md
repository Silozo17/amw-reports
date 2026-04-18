
Replace the current broken/diagnostic views fetch block in `supabase/functions/sync-facebook-page/index.ts` with the documented organic reach fetch using `page_posts_impressions_organic_unique`, and remove all debug/diagnostic logs added during this session.

**Plan:**
1. In `supabase/functions/sync-facebook-page/index.ts`:
   - Remove the temporary `ORGANIC DIAGNOSTIC` block (added after `pageToken` decryption).
   - Remove any remaining `VIEWS DEBUG` / `REACH DEBUG` console.logs from prior debugging.
   - Replace the current views fetch block (the `page_views_total` / `page_views_total_paid` block that returns 0) with the new `page_posts_impressions_organic_unique` fetch exactly as specified — using max daily value as the monthly organic reach approximation, setting `totalViews` and `coreInsightsFetched = true`.
2. Redeploy `sync-facebook-page`.
3. User manually triggers April 2026 resync for the AMW Media Facebook connection; I then pull logs to confirm `Organic reach for <pageId>: <value>` is non-zero and close to the expected ~1,026.

**Notes:**
- No other logic, no DB or frontend changes.
- Memory `mem://integrations/facebook-data-logic` should be updated after verification to reflect the new organic-reach source (single metric, max-daily approximation), but only once logs confirm the fix.
