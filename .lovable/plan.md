

# Facebook Sync Fix — Root Cause Analysis and Plan

## Findings from Edge Function Logs (hard evidence)

### Finding 1: Views are 0 because the breakdown response format is WRONG in our parser

The API returns `page_media_view` with `breakdown=is_from_ads` in a **flat format** — each day produces TWO separate entries, each with a plain numeric `value` and an `is_from_ads` string field (`"0"` for organic, `"1"` for paid):

```json
{"value": 25, "end_time": "2026-03-02T08:00:00+0000", "is_from_ads": "0"},
{"value": 0,  "end_time": "2026-03-02T08:00:00+0000", "is_from_ads": "1"}
```

Our code (line 160) checks `typeof val === 'object'` expecting `{ "false": organic, "true": paid }`. But `val` is a plain number (25, 0, etc.), so the condition NEVER matches. Result: **Views = 0 every sync.**

Log proof: `Organic views accumulated for 342811868918578: 0`

### Finding 2: Batch 2 fails entirely — 4 deprecated metrics

`page_views_total`, `page_consumptions`, `page_daily_follows_unique`, `page_daily_unfollows_unique` ALL return:
```
"(#100) The value must be a valid insights metric"
```

These metrics were deprecated. Result: **Page Views = 0, Link Clicks = 0, New Followers = 0, Unfollows = 0.**

### Finding 3: ALL per-post insights fail — `post_media_view` is deprecated

Every single post returns:
```
Post insights FAILED for ... (400): The value must be a valid insights metric
```

The metrics `post_media_view`, `post_clicks`, `post_engaged_users` are all invalid. Result: **Every post shows Views = "—", Clicks = "—".**

The valid replacement is `post_total_media_view_unique` (per Meta's v25 announcement).

### Finding 4: What IS working

- `page_total_media_view_unique` = 26,876 (Reach/Viewers — works correctly)
- `page_total_actions` (CTA clicks — works but shows 0, likely genuinely 0)
- `page_follows` (followers = 271 — works)
- `published_posts` with `reactions.summary(true), comments.summary(true), shares` — works (3 reactions, 1 comment)
- `post_reactions_by_type_total` — unknown, but the numeric call fails first so it's never reached

### Finding 5: Dashboard vs Meta Business Suite comparison

| Metric | Meta Business Suite | Our Dashboard | Status |
|--------|-------------------|---------------|--------|
| Views (total) | 27,694 | 0 | BROKEN — parser bug |
| Views (organic) | 345 | 0 | BROKEN — parser bug |
| Viewers/Reach | 26,558 | 26,876 | CLOSE (timing diff) |
| Content Interactions | 6 | 4 | CLOSE (3 reactions + 1 comment = 4, missing shares) |
| Page Views | N/A | 0 | BROKEN — deprecated metric |
| Link Clicks | N/A | 0 | BROKEN — deprecated metric |
| Post Views | 13-609 per post | 0 for all | BROKEN — deprecated metric |

---

## Fix Plan

### File 1: `supabase/functions/sync-facebook-page/index.ts`

**Fix A — Views parser (lines 147-177)**

Replace the organic views extraction. The breakdown response has FLAT entries with `is_from_ads` as a sibling field, not a nested object. Parse by iterating `metric.values`, checking each entry's `is_from_ads` field:

```
for each dayEntry in metric.values:
  if dayEntry.is_from_ads === "0" or dayEntry.is_from_ads === 0:
    totalViews += Number(dayEntry.value)  // organic only
```

Also accumulate `totalViewsAll` (organic + paid) by summing entries where `is_from_ads === "1"` separately, so we can store both.

**Fix B — Remove Batch 2 entirely (lines 196-211)**

Delete the call to `page_views_total`, `page_consumptions`, `page_daily_follows_unique`, `page_daily_unfollows_unique`. All are deprecated and return errors.

Replace follower growth with: `follower_growth = page_follows last value - page_follows first value` (already fetched in Call B, just need to capture first AND last values instead of just last).

For `page_views` and `link_clicks`: these are no longer available at page level in v25. Remove from accumulators. They'll show as 0 / hidden.

**Fix C — Replace per-post insights (lines 253-292)**

Replace `post_media_view, post_clicks, post_engaged_users` with valid v25 metrics:
- `post_total_media_view_unique` — replaces post_media_view (this is the "Views" number Meta shows per post)
- `post_clicks_by_type` — still valid as an object metric, use it for clicks total
- `post_reactions_by_type_total` — still valid

Split into:
- Call 1: `post_total_media_view_unique` (numeric, always works)
- Call 2: `post_clicks_by_type, post_reactions_by_type_total` (object metrics, separate call)

Compute `postClicks` by summing all values in `post_clicks_by_type` object.

**Fix D — Update metricsData (lines 337-358)**

Remove `page_views` and `link_clicks` from the stored metrics (they'll be 0 forever, misleading).

Update follower_growth to use `followerEnd - followerStart` from the page_follows daily values.

Keep `views` (organic), add `views_total` (organic + paid) for reference.

**Fix E — Update accumulators (lines 124-134)**

- Remove `totalPageViews`, `totalLinkClicks`, `totalNewFollowers`, `totalUnfollows`
- Add `totalViewsAll` for total views (organic + paid)
- Change `currentFollowers` to `followerStart` and `followerEnd`

### File 2: `src/types/database.ts`

**In FACEBOOK_KEY_METRICS array (PLATFORM_AVAILABLE_METRICS.facebook, line 350-356):**

Remove `page_views`, `link_clicks`, `cta_clicks` (all deprecated/unavailable).

Replace with just the working metrics:
```
facebook: [
  'views', 'reach', 'engagement', 'engagement_rate',
  'reactions', 'comments', 'shares',
  'total_followers', 'follower_growth',
  'posts_published',
]
```

### File 3: `src/components/clients/dashboard/PlatformSection.tsx`

**Update FACEBOOK_KEY_METRICS (line 80):**

Remove `page_views`, `link_clicks`, `new_followers`. Replace with metrics that actually have data:
```
const FACEBOOK_KEY_METRICS = ['views', 'reach', 'engagement', 'reactions', 'comments', 'shares', 'total_followers', 'follower_growth', 'posts_published'];
```

### File 4: `src/types/metrics.ts`

Update METRIC_EXPLANATIONS for `views` to clarify it's organic-only views.

---

## What will be accurate after this fix

| Metric | Source | Expected |
|--------|--------|----------|
| Views | page_media_view breakdown is_from_ads="0" | Organic views only |
| Reach | page_total_media_view_unique | Unique viewers (total) |
| Engagement | Sum of reactions + comments + shares from posts | True content interactions |
| Reactions | reactions.summary from published_posts | Accurate |
| Comments | comments.summary from published_posts | Accurate |
| Shares | shares.count from published_posts | Accurate |
| Total Followers | page_follows last daily value | Accurate |
| Follower Growth | page_follows last - first | Accurate |
| Post Views | post_total_media_view_unique per post | Accurate |
| Post Clicks | Sum of post_clicks_by_type values per post | Accurate |

## What will be removed (no longer available in API)

- Page Views (page_views_total — deprecated)
- Link Clicks (page_consumptions — deprecated)
- CTA Clicks (page_total_actions — may work but low value)
- New Followers / Unfollows (daily follow metrics — deprecated)

## Constraints

- No changes to other platforms
- No schema changes
- Keep all error handling, sync logs, overwrite protection
- Keep fetchPageInsights and sumDailyValues helpers

