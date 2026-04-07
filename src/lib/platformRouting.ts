/**
 * Centralized platform routing constants.
 *
 * This is the SINGLE SOURCE OF TRUTH for mapping platform database keys
 * to their connect and sync edge-function names.
 *
 * TikTok Organic  (`tiktok`)     → Login Kit API  (open.tiktokapis.com)
 *   - Credentials: TIKTOK_APP_ID / TIKTOK_APP_SECRET
 *   - Connect fn:  tiktok-ads-connect  (legacy name — actually Login Kit)
 *   - Sync fn:     sync-tiktok-business (legacy name — actually organic sync)
 *
 * TikTok Ads      (`tiktok_ads`) → Business API   (business-api.tiktok.com)
 *   - Credentials: TIKTOK_BUSINESS_APP_ID / TIKTOK_BUSINESS_APP_SECRET
 *   - Connect fn:  tiktok-business-connect (legacy name — actually Business API)
 *   - Sync fn:     sync-tiktok-ads
 *
 * LinkedIn Organic (`linkedin`)   → Organization API (pages/posts)
 *   - Credentials: LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *   - Connect fn:  linkedin-connect
 *   - Sync fn:     sync-linkedin
 *
 * LinkedIn Ads    (`linkedin_ads`) → Marketing API (ad accounts/campaigns)
 *   - Credentials: LINKEDIN_ADS_CLIENT_ID / LINKEDIN_ADS_CLIENT_SECRET
 *   - Connect fn:  linkedin-ads-connect
 *   - Sync fn:     sync-linkedin-ads
 */

import type { PlatformType } from '@/types/database';

/** Maps each platform key to its OAuth connect edge-function name. */
export const CONNECT_FUNCTION_MAP: Record<string, string> = {
  google_ads: 'google-ads-connect',
  meta_ads: 'meta-ads-connect',
  facebook: 'facebook-connect',
  instagram: 'instagram-connect',
  tiktok: 'tiktok-ads-connect',            // TikTok Organic — Login Kit
  tiktok_ads: 'tiktok-business-connect',    // TikTok Ads — Business API
  linkedin: 'linkedin-connect',
  linkedin_ads: 'linkedin-ads-connect',
  google_search_console: 'google-search-console-connect',
  google_analytics: 'google-analytics-connect',
  google_business_profile: 'google-business-connect',
  youtube: 'youtube-connect',
  pinterest: 'pinterest-connect',
};

/** Maps each platform key to its data-sync edge-function name. */
export const SYNC_FUNCTION_MAP: Record<string, string> = {
  google_ads: 'sync-google-ads',
  meta_ads: 'sync-meta-ads',
  facebook: 'sync-facebook-page',
  instagram: 'sync-instagram',
  tiktok: 'sync-tiktok-business',           // TikTok Organic
  tiktok_ads: 'sync-tiktok-ads',            // TikTok Ads
  linkedin: 'sync-linkedin',
  linkedin_ads: 'sync-linkedin-ads',
  google_search_console: 'sync-google-search-console',
  google_analytics: 'sync-google-analytics',
  google_business_profile: 'sync-google-business-profile',
  youtube: 'sync-youtube',
  pinterest: 'sync-pinterest',
};

/** All platforms that support OAuth connection. */
export const OAUTH_SUPPORTED: PlatformType[] = [
  'google_ads', 'meta_ads', 'facebook', 'instagram',
  'tiktok', 'tiktok_ads', 'linkedin', 'linkedin_ads',
  'google_search_console', 'google_analytics', 'google_business_profile',
  'youtube', 'pinterest',
];

/** All platform keys in display order. */
export const ALL_PLATFORMS: PlatformType[] = [
  'google_ads', 'meta_ads', 'facebook', 'instagram',
  'tiktok', 'tiktok_ads', 'linkedin', 'linkedin_ads',
  'google_search_console', 'google_analytics', 'google_business_profile',
  'youtube', 'pinterest',
];
