
Goal: do a diagnostic-first Facebook pass before changing any business logic, so we can see exactly what Meta returns for AMW Media in April 2026 and which paid/organic fields still work.

What I found
- The current Facebook sync only pulls a small set of data:
  - Page: `page_media_view`, `page_follows`
  - Posts list: `published_posts` fields
  - Post insights: `post_total_media_view_unique`, `post_clicks_by_type`, `post_reactions_by_type_total`
- The current bug is very likely the `page_media_view` breakdown parser, not necessarily the metric itself:
  - logs show `total=8846 paid=0 organic=8846`
  - current code only checks `value.breakdown.is_from_ads` or `value.dimension_values[0]`
  - if Meta returns breakdowns in a different shape, paid stays 0 and total gets treated as organic
- Meta docs I checked confirm these currently documented fields:
  - `page_media_view` with breakdowns `is_from_ads`, `is_from_followers`
  - `page_total_media_view_unique`
  - `page_impressions`, `page_impressions_paid`, `page_impressions_unique`
  - `page_posts_impressions`, `page_posts_impressions_paid`, `page_posts_impressions_organic_unique`
  - `page_video_views`, `page_video_views_paid`, `page_video_views_organic`, `page_video_views_by_paid_non_paid`
  - `post_media_view` with breakdowns `is_from_ads`, `is_from_followers`
  - `post_total_media_view_unique`
  - `post_impressions`, `post_impressions_paid`, `post_impressions_organic`, `post_impressions_*_unique`
  - `post_video_views`, `post_video_views_paid`, `post_video_views_organic`
- Because Meta docs and live behavior can diverge, the safest next step is to probe and log everything supported by the live page token instead of trusting a single field.

Implementation plan
1. Add a temporary “Facebook diagnostic mode” inside `supabase/functions/sync-facebook-page/index.ts` for the selected page only.
2. Keep the existing sync flow intact, but prepend broad diagnostic fetches and logs before snapshot calculation.
3. Add page-level diagnostic batches:
   - Core content/reach/view metrics
   - Paid vs organic candidates
   - video/view candidates
   - follower/fan candidates
   - media-view breakdown variants
4. Add post-level diagnostic batches for the synced posts:
   - current metrics already used by the app
   - extra media/impression/video metrics and supported breakdowns
5. For every batch, log:
   - requested metrics
   - HTTP status
   - raw error body if rejected
   - per-metric totals
   - first raw sample of the returned `values[]` shape
   - raw breakdown sample where present
6. Add one final structured summary log per sync:
   - page id/name
   - all accepted page metrics + totals
   - all rejected page metrics + errors
   - all accepted post metrics + sample values
   - current snapshot values that would be written
7. Do not change the production Views formula yet.
8. Redeploy `sync-facebook-page`.
9. You trigger the April 2026 AMW Media resync.
10. I read the logs and give you a clean report of:
   - exactly what synced from Facebook
   - which fields are valid now
   - which breakdown shapes Meta actually returned
   - the correct paid/organic subtraction logic to implement next

Technical details
- Page diagnostic groups to probe
  - Media/view: `page_media_view`, `page_total_media_view_unique`, `page_views_total`
  - Impressions/reach: `page_impressions`, `page_impressions_paid`, `page_impressions_unique`, `page_impressions_paid_unique`, `page_impressions_nonviral`, `page_impressions_nonviral_unique`
  - Post distribution: `page_posts_impressions`, `page_posts_impressions_paid`, `page_posts_impressions_unique`, `page_posts_impressions_paid_unique`, `page_posts_impressions_organic_unique`, `page_posts_impressions_nonviral`, `page_posts_impressions_nonviral_unique`
  - Video: `page_video_views`, `page_video_views_paid`, `page_video_views_organic`, `page_video_views_by_paid_non_paid`, `page_video_complete_views_30s`, `page_video_complete_views_30s_paid`, `page_video_complete_views_30s_organic`, `page_video_views_unique`
  - Followers/fans: `page_follows`, `page_fans`, `page_fan_adds`, `page_fan_adds_unique`, `page_fan_removes`
- Breakdown probes
  - `page_media_view&breakdown=is_from_ads`
  - `page_media_view&breakdown=is_from_followers`
  - `post_media_view&breakdown=is_from_ads`
  - `post_media_view&breakdown=is_from_followers`
- Logging format
  - structured JSON only where possible
  - one entry per batch, one entry per raw-shape sample, one final rollup
  - include truncated bodies to avoid oversized logs
- Safety
  - keep batching to avoid timeout/rate-limit issues
  - if “maximum possible” is too large for one execution, split diagnostics across sequential batches but still within this one function
  - do not overwrite dashboard logic yet
  - no DB schema or frontend changes

Expected result after the diagnostic run
- A concrete map of all page/post metrics Meta actually returned for AMW Media in April 2026
- Proof of whether paid data is being returned at page level, post level, both, or neither
- The exact JSON path needed to parse `is_from_ads`
- A reliable basis for the final Facebook Views fix instead of guessing
