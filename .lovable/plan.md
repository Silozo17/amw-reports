

## Fix TikTok Scope Error

Your sandbox app has exactly 4 scopes approved: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`. The connect function currently requests 9 scopes (including `user.info.username`, `user.account.type`, `user.insights`, `video.insights`, `comment.list`) which TikTok rejects.

### Changes

1. **`supabase/functions/tiktok-ads-connect/index.ts`** — Change the scope parameter from the current 9 scopes to exactly: `user.info.basic,user.info.profile,user.info.stats,video.list`

2. **`supabase/functions/sync-tiktok-ads/index.ts`** — Remove the `enrichVideosWithInsights` call (requires `video.insights` scope) and skip `comment.list` data. The video list endpoint already returns `view_count`, `like_count`, `comment_count`, `share_count` so metrics will still work. Set `avg_time_watched` and `completion_rate` to 0 until those scopes are approved.

