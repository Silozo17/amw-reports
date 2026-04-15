import { PLATFORM_LOGOS, type PlatformType } from '@/types/database';

/** Maps display names used on public pages to PlatformType keys */
const NAME_TO_KEY: Record<string, PlatformType> = {
  'Google Ads': 'google_ads',
  'Meta Ads': 'meta_ads',
  'Facebook': 'facebook',
  'Instagram': 'instagram',
  'TikTok': 'tiktok',
  'TikTok Ads': 'tiktok_ads',
  'LinkedIn': 'linkedin',
  'LinkedIn Ads': 'linkedin_ads',
  'Google Search Console': 'google_search_console',
  'Google Analytics': 'google_analytics',
  'Google Business Profile': 'google_business_profile',
  'YouTube': 'youtube',
  'Pinterest': 'pinterest',
  'Threads': 'threads',
};

/** Get the logo URL for a platform display name. Returns undefined if not found. */
export const getPlatformLogo = (displayName: string): string | undefined => {
  const key = NAME_TO_KEY[displayName];
  return key ? PLATFORM_LOGOS[key] : undefined;
};
