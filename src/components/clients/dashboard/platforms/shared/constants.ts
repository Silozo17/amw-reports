/** Priority metrics per platform category */
export const AD_PLATFORM_KEY_METRICS = ['impressions', 'clicks', 'ctr', 'spend', 'cpc', 'conversions', 'cost_per_conversion', 'reach'];
export const META_ADS_KEY_METRICS = ['impressions', 'clicks', 'ctr', 'spend', 'cpc', 'leads', 'cost_per_lead', 'reach'];
export const SOCIAL_KEY_METRICS = ['reach', 'impressions', 'engagement', 'likes', 'comments', 'shares', 'total_followers', 'follower_growth', 'profile_visits', 'website_clicks', 'video_views', 'saves', 'reel_count'];
export const LINKEDIN_KEY_METRICS = ['total_followers', 'follower_growth', 'impressions', 'engagement', 'engagement_rate', 'likes', 'comments', 'shares', 'clicks', 'page_views', 'posts_published'];
export const FACEBOOK_KEY_METRICS = ['views', 'engagement', 'reactions', 'comments', 'shares', 'total_followers', 'follower_growth', 'posts_published'];
export const ANALYTICS_KEY_METRICS = ['sessions', 'active_users', 'new_users', 'total_users', 'ga_page_views', 'bounce_rate', 'avg_session_duration', 'pages_per_session', 'engaged_sessions', 'ga_engagement_rate'];
export const GSC_KEY_METRICS = ['search_clicks', 'search_impressions', 'search_ctr', 'search_position'];
export const GBP_KEY_METRICS = ['gbp_views', 'gbp_searches', 'gbp_calls', 'gbp_direction_requests', 'gbp_website_clicks', 'gbp_reviews_count', 'gbp_average_rating', 'gbp_new_reviews', 'gbp_conversations', 'gbp_bookings', 'gbp_maps_desktop', 'gbp_maps_mobile', 'gbp_search_desktop', 'gbp_search_mobile'];
export const YOUTUBE_KEY_METRICS = ['views', 'video_views', 'watch_time', 'subscribers', 'likes', 'comments', 'avg_view_duration'];

export const PLATFORM_KEY_METRICS: Record<string, string[]> = {
  google_ads: AD_PLATFORM_KEY_METRICS,
  meta_ads: META_ADS_KEY_METRICS,
  facebook: FACEBOOK_KEY_METRICS,
  instagram: SOCIAL_KEY_METRICS,
  tiktok: SOCIAL_KEY_METRICS,
  linkedin: LINKEDIN_KEY_METRICS,
  google_analytics: ANALYTICS_KEY_METRICS,
  google_search_console: GSC_KEY_METRICS,
  google_business_profile: GBP_KEY_METRICS,
  youtube: YOUTUBE_KEY_METRICS,
};

export const COST_METRICS = new Set(['spend', 'cpc', 'cpm', 'cost_per_conversion', 'cost_per_lead']);
export const PERCENT_METRICS = new Set(['ctr', 'engagement_rate', 'bounce_rate', 'search_ctr', 'conversion_rate', 'audience_growth_rate', 'ga_engagement_rate']);
export const DECIMAL_METRICS = new Set(['search_position', 'gbp_average_rating', 'pages_per_session', 'avg_session_duration', 'avg_view_duration', 'frequency']);
