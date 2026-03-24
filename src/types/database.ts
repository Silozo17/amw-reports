import allSocialsLogo from '@/assets/logos/all-socials.webp';
import facebookLogo from '@/assets/logos/facebook.webp';
import googleLogo from '@/assets/logos/google.webp';
import instagramLogo from '@/assets/logos/instagram.webp';
import linkedinLogo from '@/assets/logos/linkedin.webp';
import metaLogo from '@/assets/logos/meta.webp';
import tiktokLogo from '@/assets/logos/tiktok.webp';

export type AppRole = 'owner' | 'manager';
export type PlatformType = 'google_ads' | 'meta_ads' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
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
  enable_upsell: boolean;
  enable_mom_comparison: boolean;
  enable_yoy_comparison: boolean;
  enable_explanations: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
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
};

export const PLATFORM_LOGOS: Record<string, string> = {
  all: allSocialsLogo,
  google_ads: googleLogo,
  meta_ads: metaLogo,
  facebook: facebookLogo,
  instagram: instagramLogo,
  tiktok: tiktokLogo,
  linkedin: linkedinLogo,
};

export const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'PLN', label: 'PLN (zł)', symbol: 'zł' },
  { value: 'CAD', label: 'CAD (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { value: 'NZD', label: 'NZD (NZ$)', symbol: 'NZ$' },
];

export const getCurrencySymbol = (code: string): string => {
  return CURRENCY_OPTIONS.find(c => c.value === code)?.symbol ?? code;
};

/** Metrics that are internal/derived and should never show as individual cards */
export const HIDDEN_METRICS = new Set(['campaign_count', 'pages_count', 'roas']);

/** Ad-specific metrics that should NOT appear on organic-only platforms */
export const AD_METRICS = new Set([
  'spend', 'cpc', 'cpm', 'cost_per_conversion', 'conversions',
  'conversions_value', 'roas', 'campaign_count', 'conversion_rate', 'leads',
]);

/** Platforms that are organic-only (no ad spend metrics) */
export const ORGANIC_PLATFORMS = new Set<PlatformType>(['facebook', 'instagram', 'linkedin']);

export const METRIC_LABELS: Record<string, string> = {
  spend: 'Spend',
  impressions: 'Impressions',
  clicks: 'Clicks',
  link_clicks: 'Link Clicks',
  ctr: 'Click-Through Rate',
  conversions: 'Conversions',
  conversion_rate: 'Conversion Rate',
  cpc: 'Cost Per Click',
  cost_per_conversion: 'Cost Per Conversion',
  reach: 'Reach',
  leads: 'Leads',
  campaign_performance: 'Campaign Performance',
  total_followers: 'Total Followers',
  follower_growth: 'Follower Growth',
  audience_growth_rate: 'Audience Growth Rate',
  page_likes: 'Page Likes',
  profile_visits: 'Profile Visits',
  engagement: 'Engagement',
  engagement_rate: 'Engagement Rate',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  video_views: 'Video Views',
  posts_published: 'Posts Published',
  top_posts: 'Top Posts',
};
