import { supabase } from '@/integrations/supabase/client';
import type { PlatformType } from '@/types/database';
import { SYNC_FUNCTION_MAP } from '@/lib/platformRouting';

// Re-export for backward compatibility
export { SYNC_FUNCTION_MAP };

/** Platform-specific caps on how many months of history can be synced. */
const PLATFORM_MAX_MONTHS: Partial<Record<PlatformType, number>> = {
  pinterest: 3, // Pinterest API limits analytics to 90 days
};

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
 * Used for manual single-month re-syncs only.
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
