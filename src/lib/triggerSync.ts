import { supabase } from '@/integrations/supabase/client';
import type { PlatformType } from '@/types/database';
import { SYNC_FUNCTION_MAP } from '@/lib/platformRouting';

// Re-export for backward compatibility
export { SYNC_FUNCTION_MAP };

interface SyncResult {
  month: number;
  year: number;
  success: boolean;
  error?: string;
}

export interface SyncProgress {
  platform: string;
  completed: number;
  total: number;
  currentMonth: number;
  currentYear: number;
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
 * Calls onProgress after each month completes.
 */
export async function triggerInitialSync(
  connectionId: string,
  platform: PlatformType,
  months: number = 12,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    onProgress?.({ platform, completed: i, total: months, currentMonth: month, currentYear: year });

    const result = await triggerSync(connectionId, platform, month, year);
    results.push(result);

    onProgress?.({ platform, completed: i + 1, total: months, currentMonth: month, currentYear: year });
  }

  return results;
}
