UPDATE public.metric_defaults
SET
  available_metrics = ARRAY['impressions','reach','profile_visits','website_clicks','email_contacts','engagement','likes','comments','saves','video_views','posts_published','reel_count','image_count','carousel_count','engagement_rate','total_followers','follower_growth','audience_growth_rate'],
  default_metrics = ARRAY['total_followers','reach','impressions','engagement','likes','comments','saves','video_views','website_clicks','posts_published','engagement_rate']
WHERE platform = 'instagram';

UPDATE public.metric_defaults
SET
  available_metrics = ARRAY['impressions','organic_impressions','paid_impressions','reach','engagement','page_views','follower_growth','follower_removes','total_followers','video_views','likes','comments','shares','posts_published','engagement_rate'],
  default_metrics = ARRAY['total_followers','follower_growth','reach','impressions','engagement','likes','comments','shares','video_views','page_views','posts_published','engagement_rate']
WHERE platform = 'facebook';

UPDATE public.metric_defaults
SET
  available_metrics = ARRAY['spend','impressions','clicks','link_clicks','reach','ctr','cpc','cpm','conversions','conversions_value','cost_per_conversion','roas','frequency','video_views','campaign_count'],
  default_metrics = ARRAY['spend','impressions','reach','clicks','link_clicks','ctr','cpc','conversions','cost_per_conversion','roas','frequency']
WHERE platform = 'meta_ads';

UPDATE public.metric_defaults
SET
  available_metrics = ARRAY['spend','impressions','clicks','ctr','cpc','cpm','conversions','conversions_value','conversion_rate','cost_per_conversion','roas','search_impression_share','campaign_count'],
  default_metrics = ARRAY['spend','impressions','clicks','ctr','cpc','conversions','conversion_rate','cost_per_conversion','roas']
WHERE platform = 'google_ads';