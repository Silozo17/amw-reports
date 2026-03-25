import { supabase } from '@/integrations/supabase/client';
import type { PlatformType } from '@/types/database';

/**
 * Remove a platform connection and all associated data
 * (snapshots, sync logs, platform config) for that client+platform.
 */
export const removeConnectionAndData = async (
  connectionId: string,
  clientId: string,
  platform: PlatformType,
): Promise<{ error: string | null }> => {
  // Delete the connection
  const { error: connErr } = await supabase
    .from('platform_connections')
    .delete()
    .eq('id', connectionId);

  if (connErr) return { error: connErr.message };

  // Delete associated data in parallel
  await Promise.all([
    supabase
      .from('monthly_snapshots')
      .delete()
      .eq('client_id', clientId)
      .eq('platform', platform),
    supabase
      .from('sync_logs')
      .delete()
      .eq('client_id', clientId)
      .eq('platform', platform),
    supabase
      .from('client_platform_config')
      .delete()
      .eq('client_id', clientId)
      .eq('platform', platform),
  ]);

  return { error: null };
};
