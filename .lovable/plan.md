
Switch Facebook organic views from the deprecated `page_posts_impressions_organic_unique` to `page_media_view` with the `is_from_ads` breakdown, and display `total - is_from_ads=true = organic` as Views.

**Plan:**
1. In `supabase/functions/sync-facebook-page/index.ts`, replace the current organic reach fetch block with:
   - Endpoint: `GET {GRAPH_BASE}/{pageId}/insights?metric=page_media_view&breakdown=is_from_ads&period=day&since={startDate}&until={endDate}&access_token={pageToken}`
   - Sum daily `value` entries to get `totalMediaViews`.
   - Sum daily `value` entries where the `is_from_ads` breakdown key === `true` (or `"1"`) to get `paidMediaViews`.
   - `organicMediaViews = Math.max(0, totalMediaViews - paidMediaViews)`.
   - Assign `totalViews = organicMediaViews` and set `coreInsightsFetched = true`.
   - Log a single concise line: `Facebook organic views for {pageId}: total={x} paid={y} organic={z}` for verification, then plan to remove after confirmation.
   - Handle non-OK responses with a single `console.error` containing status + truncated body.
2. Leave all other logic (posts loop, video metrics, storage shape) untouched.
3. Redeploy `sync-facebook-page`.
4. User triggers an April 2026 resync for AMW Media; I pull logs to confirm the organic value is sensible (and matches Meta Business Suite's "From organic"). Once confirmed, remove the temporary log and update `mem://integrations/facebook-data-logic` to record:
   - Source: `page_media_view` with `is_from_ads` breakdown
   - Formula: `total - paid = organic`
   - Reason: `page_posts_impressions_organic_unique` deprecated 2025-06-15

**Notes:**
- No DB or frontend changes — only the sync function.
- Exact response shape for the `is_from_ads` breakdown key (`true` vs `"1"`) will be validated from the live April 2026 response; the code will defensively handle both.
