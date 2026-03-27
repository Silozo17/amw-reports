import allSocialsLogo from '@/assets/logos/all-socials.webp';
import facebookLogo from '@/assets/logos/facebook.webp';
import googleLogo from '@/assets/logos/google.webp';
import instagramLogo from '@/assets/logos/instagram.webp';
import linkedinLogo from '@/assets/logos/linkedin.webp';
import metaLogo from '@/assets/logos/meta.webp';
import tiktokLogo from '@/assets/logos/tiktok.webp';
import gscLogo from '@/assets/logos/google-search-console.webp';
import gaLogo from '@/assets/logos/google-analytics.webp';
import gbpLogo from '@/assets/logos/google-business.webp';
import youtubeLogo from '@/assets/logos/youtube.webp';
import pinterestLogo from '@/assets/logos/pinterest.webp';

export type AppRole = 'owner' | 'manager';
export type PlatformType = 'google_ads' | 'meta_ads' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'google_search_console' | 'google_analytics' | 'google_business_profile' | 'youtube' | 'pinterest';
export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

export interface Organisation {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  report_settings: { show_logo: boolean; show_ai_insights: boolean } | null;
  button_color: string | null;
  button_text_color: string | null;
  text_on_dark: string | null;
  text_on_light: string | null;
  show_org_name: boolean;
  chart_color_1: string | null;
  chart_color_2: string | null;
  chart_color_3: string | null;
  chart_color_4: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: 'owner' | 'manager';
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  org_id: string | null;
  phone: string | null;
  position: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  full_name: string;
  position: string | null;
  company_name: string;
  phone: string | null;
  email: string | null;
  business_address: string | null;
  website: string | null;
  social_handles: Record<string, string>;
  services_subscribed: string[];
  notes: string | null;
  is_active: boolean;
  preferred_currency: string;
  preferred_timezone: string;
  reporting_start_date: string | null;
  account_manager: string | null;
  report_detail_level: string;
  report_language: string;
  enable_upsell: boolean;
  enable_mom_comparison: boolean;
  enable_yoy_comparison: boolean;
  enable_explanations: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
  scheduled_deletion_at: string | null;
}

export interface ClientRecipient {
  id: string;
  client_id: string;
  name: string;
  email: string;
  is_primary: boolean;
  created_at: string;
}

export interface PlatformConnection {
  id: string;
  client_id: string;
  platform: PlatformType;
  account_name: string | null;
  account_id: string | null;
  is_connected: boolean;
  last_sync_at: string | null;
  last_sync_status: JobStatus | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  client_id: string;
  org_id: string;
  report_month: number;
  report_year: number;
  status: JobStatus;
  pdf_storage_path: string | null;
  ai_executive_summary: string | null;
  ai_insights: string | null;
  ai_upsell_recommendations: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  client_id: string;
  org_id: string;
  platform: PlatformType;
  status: JobStatus;
  report_month: number;
  report_year: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  triggered_by: string | null;
}

export interface EmailLog {
  id: string;
  report_id: string | null;
  client_id: string;
  org_id: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export const PLATFORM_LABELS: Record<PlatformType, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  google_search_console: 'Google Search Console',
  google_analytics: 'Google Analytics',
  google_business_profile: 'Google Business Profile',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
};

export const PLATFORM_LOGOS: Record<string, string> = {
  all: allSocialsLogo,
  google_ads: googleLogo,
  meta_ads: metaLogo,
  facebook: facebookLogo,
  instagram: instagramLogo,
  tiktok: tiktokLogo,
  linkedin: linkedinLogo,
  google_search_console: gscLogo,
  google_analytics: gaLogo,
  google_business_profile: gbpLogo,
  youtube: youtubeLogo,
  pinterest: pinterestLogo,
};

export const CURRENCY_OPTIONS = [
  { value: 'AED', label: 'AED (د.إ)', symbol: 'د.إ' },
  { value: 'ARS', label: 'ARS (AR$)', symbol: 'AR$' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { value: 'BGN', label: 'BGN (лв)', symbol: 'лв' },
  { value: 'BRL', label: 'BRL (R$)', symbol: 'R$' },
  { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
  { value: 'CHF', label: 'CHF (CHF)', symbol: 'CHF' },
  { value: 'CLP', label: 'CLP (CL$)', symbol: 'CL$' },
  { value: 'CNY', label: 'CNY (¥)', symbol: '¥' },
  { value: 'COP', label: 'COP (CO$)', symbol: 'CO$' },
  { value: 'CZK', label: 'CZK (Kč)', symbol: 'Kč' },
  { value: 'DKK', label: 'DKK (kr)', symbol: 'kr' },
  { value: 'EGP', label: 'EGP (E£)', symbol: 'E£' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'GEL', label: 'GEL (₾)', symbol: '₾' },
  { value: 'HKD', label: 'HKD (HK$)', symbol: 'HK$' },
  { value: 'HRK', label: 'HRK (kn)', symbol: 'kn' },
  { value: 'HUF', label: 'HUF (Ft)', symbol: 'Ft' },
  { value: 'IDR', label: 'IDR (Rp)', symbol: 'Rp' },
  { value: 'ILS', label: 'ILS (₪)', symbol: '₪' },
  { value: 'INR', label: 'INR (₹)', symbol: '₹' },
  { value: 'ISK', label: 'ISK (kr)', symbol: 'kr' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { value: 'KRW', label: 'KRW (₩)', symbol: '₩' },
  { value: 'MAD', label: 'MAD (MAD)', symbol: 'MAD' },
  { value: 'MXN', label: 'MXN (MX$)', symbol: 'MX$' },
  { value: 'MYR', label: 'MYR (RM)', symbol: 'RM' },
  { value: 'NGN', label: 'NGN (₦)', symbol: '₦' },
  { value: 'NOK', label: 'NOK (kr)', symbol: 'kr' },
  { value: 'NZD', label: 'NZD (NZ$)', symbol: 'NZ$' },
  { value: 'PEN', label: 'PEN (S/.)', symbol: 'S/.' },
  { value: 'PHP', label: 'PHP (₱)', symbol: '₱' },
  { value: 'PKR', label: 'PKR (₨)', symbol: '₨' },
  { value: 'PLN', label: 'PLN (zł)', symbol: 'zł' },
  { value: 'QAR', label: 'QAR (QR)', symbol: 'QR' },
  { value: 'RON', label: 'RON (lei)', symbol: 'lei' },
  { value: 'RUB', label: 'RUB (₽)', symbol: '₽' },
  { value: 'SAR', label: 'SAR (SAR)', symbol: 'SAR' },
  { value: 'SEK', label: 'SEK (kr)', symbol: 'kr' },
  { value: 'SGD', label: 'SGD (S$)', symbol: 'S$' },
  { value: 'THB', label: 'THB (฿)', symbol: '฿' },
  { value: 'TRY', label: 'TRY (₺)', symbol: '₺' },
  { value: 'TWD', label: 'TWD (NT$)', symbol: 'NT$' },
  { value: 'UAH', label: 'UAH (₴)', symbol: '₴' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'UYU', label: 'UYU (UY$)', symbol: 'UY$' },
  { value: 'VND', label: 'VND (₫)', symbol: '₫' },
  { value: 'ZAR', label: 'ZAR (R)', symbol: 'R' },
];

export const getCurrencySymbol = (code: string): string => {
  return CURRENCY_OPTIONS.find(c => c.value === code)?.symbol ?? code;
};

/** Metrics that are internal/derived and should never show as individual cards */
export const HIDDEN_METRICS = new Set(['campaign_count', 'pages_count', 'roas', 'unfollows', 'post_views', 'post_clicks']);

/** Ad-specific metrics that should NOT appear on organic-only platforms */
export const AD_METRICS = new Set([
  'spend', 'cpc', 'cpm', 'cost_per_conversion', 'conversions',
  'conversions_value', 'roas', 'campaign_count', 'conversion_rate', 'leads',
  'cost_per_lead',
]);

/** Platforms that are organic-only (no ad spend metrics) */
export const ORGANIC_PLATFORMS = new Set<PlatformType>(['facebook', 'instagram', 'tiktok', 'linkedin', 'google_search_console', 'google_analytics', 'google_business_profile', 'youtube', 'pinterest']);

export const METRIC_LABELS: Record<string, string> = {
  spend: 'Spend',
  impressions: 'Impressions',
  
  paid_impressions: 'Paid Impressions',
  clicks: 'Clicks',
  link_clicks: 'Link Clicks',
  organic_clicks: 'Organic Clicks',
  ctr: 'Click-Through Rate',
  conversions: 'Conversions',
  conversions_value: 'Conversions Value',
  conversion_rate: 'Conversion Rate',
  cpc: 'Cost Per Click',
  cpm: 'CPM',
  cost_per_conversion: 'Cost Per Conversion',
  cost_per_lead: 'Cost Per Lead',
  roas: 'ROAS',
  reach: 'Reach',
  frequency: 'Frequency',
  search_impression_share: 'Search Impression Share',
  leads: 'Leads',
  campaign_performance: 'Campaign Performance',
  total_followers: 'Total Followers',
  follower_growth: 'Follower Growth',
  follower_removes: 'Unfollows',
  audience_growth_rate: 'Audience Growth Rate',
  page_likes: 'Page Likes',
  page_views: 'Page Views',
  profile_visits: 'Profile Visits',
  engagement: 'Engagement',
  engagement_rate: 'Engagement Rate',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  reactions: 'Reactions',
  video_views: 'Video Views',
  average_watch_time: 'Avg Watch Time (s)',
  posts_published: 'Posts Published',
  reel_count: 'Reels Published',
  image_count: 'Images Published',
  carousel_count: 'Carousels Published',
  website_clicks: 'Website Clicks',
  email_contacts: 'Email Taps',
  media_count: 'Total Posts',
  top_posts: 'Top Posts',
  search_clicks: 'Search Clicks',
  search_impressions: 'Search Impressions',
  search_ctr: 'Search CTR',
  search_position: 'Avg. Position',
  top_queries: 'Top Queries',
  gsc_top_pages: 'Top Pages (Search)',
  sessions: 'Sessions',
  active_users: 'Active Users',
  new_users: 'New Users',
  ga_page_views: 'Page Views (GA)',
  bounce_rate: 'Bounce Rate',
  avg_session_duration: 'Avg. Session Duration',
  pages_per_session: 'Pages / Session',
  traffic_sources: 'Traffic Sources',
  gbp_views: 'Profile Views',
  gbp_searches: 'Search Appearances',
  gbp_calls: 'Phone Calls',
  gbp_direction_requests: 'Direction Requests',
  gbp_website_clicks: 'Website Clicks (GBP)',
  gbp_reviews_count: 'Reviews Count',
  gbp_average_rating: 'Avg. Rating',
  subscribers: 'Net Subscribers',
  views:          'Views',
  watch_time: 'Watch Time (min)',
  videos_published: 'Videos Published',
  avg_view_duration: 'Avg. View Duration (s)',
  top_videos: 'Top Videos',
  completion_rate: 'Completion Rate',
  average_time_watched: 'Avg. Watch Time (s)',
  profile_views: 'Profile Views',
  bio_link_clicks: 'Bio Link Clicks',
  total_video_count: 'Total Videos',
  total_likes_received: 'Total Likes Received',
  following: 'Following',
  paid_reach: 'Paid Reach',
  paid_video_views: 'Paid Video Views',
  total_impressions: 'Total Impressions',
  total_video_views: 'Total Video Views',
  new_followers:  'New Followers',
  cta_clicks:     'CTA Clicks',
  post_views:     'Post Views',
  post_clicks:    'Post Clicks',
  engaged_users:  'Engaged Users',
  pin_clicks:     'Pin Clicks',
  outbound_clicks: 'Outbound Clicks',
  total_pins:     'Total Pins',
  total_boards:   'Total Boards',
  top_boards:     'Top Boards',
};

/** Platform-specific metrics — only these metrics are relevant per platform */
export const PLATFORM_AVAILABLE_METRICS: Record<PlatformType, string[]> = {
  google_ads: [
    'spend', 'impressions', 'clicks', 'ctr', 'conversions', 'conversions_value',
    'conversion_rate', 'cpc', 'cpm', 'cost_per_conversion', 'roas', 'reach',
    'search_impression_share', 'leads',
  ],
  meta_ads: [
    'spend', 'impressions', 'reach', 'clicks', 'link_clicks', 'ctr',
    'leads', 'cpc', 'cpm', 'cost_per_lead', 'frequency',
  ],
  facebook: [
    'views', 'reach', 'engagement', 'engagement_rate',
    'reactions', 'comments', 'shares',
    'total_followers', 'follower_growth',
    'posts_published',
  ],
  instagram: [
    'total_followers', 'follower_growth', 'profile_visits', 'reach',
    'engagement', 'engagement_rate', 'likes', 'comments', 'shares', 'saves',
    'posts_published', 'reel_count', 'image_count', 'carousel_count',
    'video_views', 'website_clicks', 'email_contacts', 'media_count',
    'organic_impressions',
  ],
  tiktok: [
    'total_followers', 'follower_growth', 'video_views', 'profile_views',
    'likes', 'comments', 'shares', 'engagement_rate',
    'total_likes_received', 'total_video_count', 'bio_link_clicks',
    'completion_rate', 'average_time_watched', 'following',
  ],
  linkedin: [
    'total_followers', 'follower_growth', 'follower_removes',
    'impressions', 'engagement', 'engagement_rate', 'likes', 'comments',
    'shares', 'clicks', 'posts_published', 'video_views',
    'organic_impressions',
  ],
  google_search_console: [
    'search_clicks', 'search_impressions', 'search_ctr', 'search_position',
    'top_queries', 'gsc_top_pages',
  ],
  google_analytics: [
    'sessions', 'active_users', 'new_users', 'ga_page_views',
    'bounce_rate', 'avg_session_duration', 'pages_per_session',
    'traffic_sources',
  ],
  google_business_profile: [
    'gbp_views', 'gbp_searches', 'gbp_calls', 'gbp_direction_requests',
    'gbp_website_clicks', 'gbp_reviews_count', 'gbp_average_rating',
  ],
  youtube: [
    'subscribers', 'views', 'watch_time', 'videos_published',
    'avg_view_duration', 'top_videos',
  ],
  pinterest: [
    'impressions', 'saves', 'pin_clicks', 'outbound_clicks',
    'engagement', 'engagement_rate', 'total_followers',
    'total_pins', 'total_boards', 'top_boards',
  ],
};
