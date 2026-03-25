

## Plan: Display All Facebook Metrics on Dashboard

### Problem
The sync now pulls `link_clicks`, `page_views`, `video_views`, `organic_impressions`, `paid_impressions`, `follower_growth`, and `posts_published` — but:
1. The `metric_defaults` table for facebook doesn't include `link_clicks` or `page_views` in `available_metrics` or `default_metrics`
2. The top-level KPI cards don't show Link Clicks or Page Views
3. The KPI sparkline data doesn't track these new metrics

Since there's no `client_platform_config` row for AMW Media's facebook, the PlatformMetricsCard currently shows all metrics unfiltered — so the per-platform card should already display them. But the metric_defaults should be updated for when metric configuration is used.

### Changes

#### 1. Database Migration — Update `metric_defaults` for Facebook
Add `link_clicks`, `page_views`, and `video_views` to both `available_metrics` and `default_metrics`:
```sql
UPDATE metric_defaults 
SET available_metrics = '{impressions,organic_impressions,paid_impressions,reach,engagement,page_views,link_clicks,follower_growth,follower_removes,total_followers,video_views,likes,comments,shares,reactions,posts_published,engagement_rate}',
    default_metrics = '{total_followers,follower_growth,reach,impressions,engagement,likes,comments,shares,video_views,posts_published,engagement_rate,link_clicks,page_views}'
WHERE platform = 'facebook';
```

#### 2. `src/components/clients/ClientDashboard.tsx` — Add Link Clicks + Page Views to KPIs
- Add `link_clicks` and `page_views` aggregation to the `kpis` useMemo (lines 524-597)
- Add corresponding sparkline data entries in `sparklineMap` (lines 600-632)
- Show Link Clicks KPI when value > 0 (with MousePointerClick icon)
- Show Page Views KPI when value > 0 (with Eye icon)

#### 3. `src/types/database.ts` — Verify labels exist
Already has `link_clicks: 'Link Clicks'` and `page_views: 'Page Views'` — no change needed.

### Files to modify
1. Database migration (metric_defaults update)
2. `src/components/clients/ClientDashboard.tsx` — KPI cards + sparklines

