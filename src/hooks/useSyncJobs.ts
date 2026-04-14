import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformType } from '@/types/database';

export interface SyncJob {
  id: string;
  connection_id: string;
  client_id: string;
  org_id: string;
  platform: PlatformType;
  months: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_completed: number;
  progress_total: number;
  current_month: number | null;
  current_year: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  priority: number;
}

interface UseSyncJobsResult {
  activeJobs: SyncJob[];
  isAnySyncing: boolean;
  enqueueSync: (params: {
    connectionId: string;
    clientId: string;
    orgId: string;
    platform: PlatformType;
    months: number;
    priority?: number;
  }) => Promise<void>;
}

export function useSyncJobs(clientId: string | undefined): UseSyncJobsResult {
  const [activeJobs, setActiveJobs] = useState<SyncJob[]>([]);

  const fetchJobs = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    setActiveJobs((data as unknown as SyncJob[]) ?? []);
  }, [clientId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!clientId) return;

    fetchJobs();

    const channel = supabase
      .channel(`sync-jobs-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_jobs',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, fetchJobs]);

  const enqueueSync = useCallback(
    async ({
      connectionId,
      clientId: cId,
      orgId,
      platform,
      months,
      priority = 0,
    }: {
      connectionId: string;
      clientId: string;
      orgId: string;
      platform: PlatformType;
      months: number;
      priority?: number;
    }) => {
      // Check for existing pending/processing job for same connection+platform
      const { data: existing } = await supabase
        .from('sync_jobs')
        .select('id')
        .eq('connection_id', connectionId)
        .eq('platform', platform)
        .in('status', ['pending', 'processing'])
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Sync job already queued for ${platform} on connection ${connectionId}`);
        return;
      }

      const { error } = await supabase.from('sync_jobs').insert({
        connection_id: connectionId,
        client_id: cId,
        org_id: orgId,
        platform,
        months,
        priority,
      });

      if (error) {
        console.error('Failed to enqueue sync job:', error);
        throw error;
      }

      // Fire-and-forget: trigger the queue processor
      supabase.functions.invoke('process-sync-queue').catch((err) => {
        console.warn('Failed to trigger queue processor (will retry via cron):', err);
      });

      // Refresh jobs list
      await fetchJobs();
    },
    [fetchJobs]
  );

  return {
    activeJobs,
    isAnySyncing: activeJobs.length > 0,
    enqueueSync,
  };
}
