
User approved all three recommendations from the audit. Plan covers all three in one go.

## Files to change

### 1. `supabase/functions/sync-facebook-page/index.ts` — Apply organic formula + remove deprecated probes

**A. Switch Views metric to organic = total − paid_post_impressions**
- Locate where `page_media_view` is written into `metrics_data` (the "views" field)
- Change formula: `views = page_media_view − page_posts_impressions_paid` (floor at 0)
- Keep raw values stored in `raw_data` for diagnostic/debug purposes
- Drop reliance on the `is_from_ads` breakdown for the headline number (we proved it returns 0 for media_view)

**B. Remove deprecated metric probes (June 15, 2025 deprecations)**
- Remove from page-level metric requests: `page_impressions`, `page_impressions_unique`, `page_impressions_paid`, `page_impressions_organic_unique`, `page_fans`, `page_fan_adds`, `page_fan_removes`, `page_follows`, `page_daily_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique`
- Keep working metrics: `page_media_view`, `page_posts_impressions_paid`, `page_posts_impressions_organic_unique`, `page_video_views`, `page_video_views_paid`, `post_media_view`, post engagement metrics
- This stops the 11 rejected-metric warnings cluttering every sync log

### 2. `supabase/functions/facebook-connect/index.ts` — Drop unnecessary `ads_read` scope

- Revert scope from `pages_show_list,pages_read_engagement,read_insights,ads_read` back to `pages_show_list,pages_read_engagement,read_insights`
- Reasoning confirmed by audit: `page_posts_impressions_paid` returns non-zero **without** `ads_read` (it's a page insight, not an ads insight). Keeping `ads_read` only adds friction to the Meta consent screen for future client connections without adding any data we use.

## Out of scope
- No dashboard UI changes — `views` field name stays the same, only the underlying number changes
- No DB schema changes
- No changes to other sync functions

## User action required after deploy
1. Trigger a fresh April 2026 Facebook resync for AMW Media
2. Verify dashboard shows ~9,182 views (was 11,703) — confirms organic formula applied
3. Verify sync logs no longer list 11 rejected deprecated metrics
4. (Optional) Disconnect + reconnect Facebook — Meta consent screen should now be lighter (no "Access ads-related stats")

## Risk
- **Low.** Subtraction formula is defensive (floored at 0), so any edge case where paid > total just returns 0 instead of negative. Removing `ads_read` is purely a scope reduction. Removing deprecated metric probes only stops noise — those metrics already returned errors and weren't used.
