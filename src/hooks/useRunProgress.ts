import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RunProgressEvent {
  id: string;
  phase: string;
  status: string;
  message: string | null;
  created_at: string;
}

/** Polls run progress every 4s while the run is active. */
export const useRunProgress = (runId: string | undefined, isActive: boolean) =>
  useQuery({
    queryKey: ['cl-run-progress', runId],
    enabled: !!runId,
    refetchInterval: isActive ? 4000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_run_progress')
        .select('id, phase, status, message, created_at')
        .eq('run_id', runId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as RunProgressEvent[];
    },
  });
