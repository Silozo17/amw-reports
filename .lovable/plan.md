

# Fix Facebook Sync Timeout for High-Volume Pages

## Root Cause

Black Steel Doors publishes ~165 posts/month. The current `sync-facebook-page` function makes **2 sequential API calls per post** (post views + post clicks/reactions), totalling ~330+ HTTP requests. Edge functions timeout at ~60 seconds, so the function is killed mid-execution — the sync_log stays "running" forever with no error captured.

Evidence:
- sync_log `59f64aad` started at 05:00:44 on March 28, status "running", no completion, no error
- Client c2b194b6 (8 posts) synced fine in ~20 seconds
- Client d17e96b1 (165 posts) timed out

## Fix: Batch Post Insights Using IDs Filter

Instead of calling the Graph API individually for each post, use Meta's batch approach — fetch insights for **multiple posts in a single request** using the `ids` parameter. This reduces 330 calls down to ~10-15.

### Changes to `supabase/functions/sync-facebook-page/index.ts`

**Replace the per-post insights loop (lines 276-317)** with a batched approach:

1. **Collect all post IDs** from the `published_posts` response first (no change to existing pagination loop)
2. **After collecting all posts**, batch-fetch insights using `?ids={id1},{id2},...&fields=insights.metric(post_impressions_unique,post_total_media_view_unique,post_clicks_by_type,post_reactions_by_type_total)` — batches of 25 post IDs per call
3. **Merge** the batched insights back into the `allTopPosts` array

This reduces API calls from `2 × N` to `ceil(N / 25)` — for 165 posts that's ~7 calls instead of 330.

### Specific Code Changes

1. **Split the posts loop** into two phases:
   - **Phase 1** (existing loop, simplified): Collect post metadata (message, reactions, comments, shares, etc.) — no per-post API calls
   - **Phase 2** (new): Batch-fetch `post_impressions_unique`, `post_total_media_view_unique`, `post_clicks_by_type`, `post_reactions_by_type_total` for all posts in chunks of 25

2. **Add a `batchFetchPostInsights` helper function** that takes an array of post IDs and a page token, calls the Graph API once for a batch, and returns a map of `postId → { views, clicks, clicksByType, reactionBreakdown }`

3. **Add a timeout safety net**: wrap the entire handler in a 50-second deadline check — if approaching timeout, skip remaining post insight batches and save what we have with status "partial" instead of crashing silently

4. **Fix the stuck sync_log**: Add cleanup logic at the start of the function — if a sync_log already exists with status "running" for the same client+platform+month and is older than 5 minutes, mark it as "failed" with "Timeout — sync did not complete"

### Additional Resilience

- Add `AbortController` with 8-second timeout on each fetch call to prevent a single slow API response from blocking the entire function
- Cap post processing at 200 posts max — beyond that, take top 200 by engagement and skip the rest (diminishing returns on insight data for very old/low-engagement posts)

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/sync-facebook-page/index.ts` | Batch post insights, add timeout safety, add stuck-log cleanup |

## Immediate Data Fix

After deploying, manually retry the sync for Black Steel Doors to populate March data. The stuck "running" sync_log will be cleaned up automatically by the new startup logic.

