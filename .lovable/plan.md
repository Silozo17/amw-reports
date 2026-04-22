

## Threads sync — full coverage of available API metrics

### What the Threads API actually exposes (April 2026 docs)

**User Insights (`/{user-id}/threads_insights`)**
- `views` (time series — profile views) ✅ already synced
- `likes`, `replies`, `reposts`, `quotes` (totals) ✅ already synced
- `clicks` (link total values — clicks on URLs in your posts) ⚠️ requested but never parsed
- `followers_count` (total) ✅ already synced
- `follower_demographics` (countries, cities, age, gender — needs ≥100 followers, separate breakdown call) ❌ not synced

**Per-Media Insights (`/{media-id}/insights`)**
- `views`, `likes`, `replies`, `reposts`, `quotes`, `shares` ⚠️ we currently fetch only `views,reposts,quotes` and use `like_count`/`reply_count` from the media object — missing `shares` (different from reposts)

**Profile (`/{user-id}?fields=...`)**
- `id`, `username`, `name`, `threads_profile_picture_url`, `threads_biography`, `is_verified` ❌ not fetched at all

**Media object fields**
- We currently request: `id, text, timestamp, media_type, permalink, like_count, reply_count`
- Available and useful: `username`, `media_url` (image/video URL for thumbnails), `is_quote_post`, `has_replies`, `is_reply`, `children` (carousel) ❌ none fetched

### Gap analysis vs. our DB / UI

Current `metricsData` written: `views, likes, comments, shares, quotes, clicks (always 0), engagement, engagement_rate, posts_published, total_followers`.

Bugs and gaps:
1. **`clicks` is always `0`** — we request the `clicks` metric but never parse it because the response uses `link_total_values` (not `values`). The user sees Clicks = 0 always.
2. **No profile metadata persisted** — `is_verified`, profile picture, bio, display name, username are never stored on the connection; the dashboard can't show "verified" or profile-pic header.
3. **No follower demographics** — we sync this for Instagram/Facebook but not for Threads, even though the API supports it (≥100 followers required).
4. **Per-post `shares` missing** — we put `reposts` into the `shares` column. Threads has both `reposts` and `shares` (separate metrics in the docs); the post table's "Shares" column is misleading.
5. **No post thumbnails** — `media_url` not requested; the post table can't show images even though the API exposes them.
6. **Top-content table only shows posts that have engagement** — `ThreadsExtras` filters `caption || likes || comments || shares` so a brand-new post with views but zero engagement is hidden.

### Changes (3 files, no schema changes — all data fits existing JSONB columns)

**1. `supabase/functions/sync-threads/index.ts`** — full metric coverage
- **Fix `clicks` parsing**: handle `link_total_values` array on the user-insights response and sum the `value` fields. Aggregate per-link click totals are already what we want as a single `clicks` number.
- **Add per-post `shares`**: fetch `views,likes,replies,reposts,quotes,shares` on each post's `/insights` (currently only views/reposts/quotes). Store `reposts` and `shares` separately.
- **Fetch profile fields once per sync**: `GET /{user-id}?fields=id,username,name,threads_profile_picture_url,threads_biography,is_verified` and persist to `platform_connections.metadata` (`username`, `display_name`, `profile_picture_url`, `biography`, `is_verified`). Also refresh `account_name` if it changed.
- **Add follower demographics** (best-effort, non-blocking, only when `followers_count ≥ 100`): four breakdown calls (`country`, `city`, `age`, `gender`) against `/{user-id}/threads_insights?metric=follower_demographics&breakdown=...`. Store the merged result in `metricsData.follower_demographics` (same JSONB shape we use for Instagram/Facebook).
- **Add `media_url` and `username`** to the media field list so the post table can render thumbnails and per-post author info. Persist `media_url` and `is_quote_post` in `top_content`.
- **New aggregated metric**: `profile_views` (= the `views` time-series total, which is profile views per Meta's docs — currently we labelled it `views` only). Keep `views` for back-compat and add `profile_views` so the dashboard label is accurate.
- **Engagement rate denominator fix**: per Meta docs, `views` on a user's `threads_insights` is *profile views*, not impressions. Compute `engagement_rate = totalEngagement / max(totalViews, sumOfPostViews) * 100` — fall back to summed per-post views (more meaningful) when profile-views is small.

**2. `src/components/clients/dashboard/platforms/ThreadsExtras.tsx`** — display the new data
- Add a thumbnail column (uses `media_url`) before the post text.
- Replace the empty-content filter with one that shows any post that has *any* of: caption, views, likes, comments, shares, quotes, reposts (so newly-published posts with views but no engagement still appear).
- Add separate `Reposts` and `Shares` columns (currently one column conflates them).
- Show a small badge for `is_quote_post` posts.

**3. `src/types/database.ts` + `src/components/clients/dashboard/platforms/shared/constants.ts`** — register new metrics
- Add `profile_views`, `reposts` (already in `METRIC_LABELS`) to the `threads` entry of `PLATFORM_METRIC_DEFINITIONS` and to `THREADS_KEY_METRICS`. Final ordered key metrics:
  `total_followers, follower_growth, profile_views, views, likes, comments, replies (alias of comments), reposts, shares, quotes, clicks, engagement, engagement_rate, posts_published`.
- No new metric labels needed for any of these — all already exist in `METRIC_LABELS`.

### Out of scope
- Profile-picture header rendering on the dashboard tile (would need a new component slot — flag for follow-up).
- Geo-heatmap integration of Threads `follower_demographics` — data will be stored in the snapshot but the existing GeoHeatmap component already reads any platform's `follower_demographics.country`, so it picks up automatically once the data lands; no UI change required for that to start working.
- Mentions / Keyword Search APIs (separate product, requires `threads_keyword_search` permission and an app review — out of scope for organic reporting).
- `replies_count`, `likes_count` etc. from the public Profile Discovery API (different permission, different use case — competitor lookup, not own-account reporting).

### Verification
- After the change, a synced month for a Threads connection persists: `total_followers, follower_growth, profile_views, views, likes, comments, shares, reposts, quotes, clicks (>0 when links were shared), engagement, engagement_rate, posts_published, follower_demographics{...}` in `monthly_snapshots.metrics_data`.
- `platform_connections.metadata` for Threads now contains `username, display_name, profile_picture_url, biography, is_verified`.
- Dashboard Threads section shows the full metric grid (no missing-zero-only cards), and the post table renders thumbnails plus separate Reposts/Shares columns.
- Existing snapshots stay valid (additive only — no removed metrics, no schema changes).

