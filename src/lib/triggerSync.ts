import { supabase } from '@/integrations/supabase/client';
import type { PlatformType } from '@/types/database';

/**
 * Maps each platform to its corresponding sync edge function name.
 * This is the single source of truth for sync function routing.
 */
export const SYNC_FUNCTION_MAP: Record<string, string> = {
  google_ads: 'sync-google-ads',
  meta_ads: 'sync-meta-ads',
  facebook: 'sync-facebook-page',
  instagram: 'sync-instagram',
  tiktok: 'sync-tiktok-ads',
  linkedin: 'sync-linkedin',
  google_search_console: 'sync-google-search-console',
  google_analytics: 'sync-google-analytics',
  google_business_profile: 'sync-google-business-profile',
  youtube: 'sync-youtube',
};

interface SyncResult {
  month: number;
  year: number;
  success: boolean;
  error?: string;
}

/**
 * Triggers a sync for a single platform connection for a specific month/year.
 */
export async function triggerSync(
  connectionId: string,
  platform: PlatformType,
  month: number,
  year: number,
): Promise<SyncResult> {
  const fnName = SYNC_FUNCTION_MAP[platform];
  if (!fnName) {
    return { month, year, success: false, error: `No sync function for ${platform}` };
  }

  try {
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { connection_id: connectionId, month, year },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { month, year, success: true };
  } catch (e) {
    return {
      month,
      year,
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Triggers sync for the last N months sequentially (to avoid rate limits).
 */
export async function triggerInitialSync(
  connectionId: string,
  platform: PlatformType,
  months: number = 12,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const result = await triggerSync(connectionId, platform, month, year);
    results.push(result);
  }

  return results;
}
