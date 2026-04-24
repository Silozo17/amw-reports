import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StartOptions {
  /** Navigate to the run detail page when started. Default true. */
  navigateOnStart?: boolean;
}

/** Shared hook that triggers a Content Lab run for a client. */
export const useStartContentLabRun = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);

  const start = async (clientId: string, opts: StartOptions = {}) => {
    const { navigateOnStart = true } = opts;
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-run', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      toast.success("Run started — we'll email you when ideas are ready (~3-6 min).");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['content-lab-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['content-lab-usage'] }),
      ]);
      const runId = (data as { run_id?: string } | null)?.run_id;
      if (runId && navigateOnStart) navigate(`/content-lab/run/${runId}`);
      return runId;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start run');
      return null;
    } finally {
      setStarting(false);
    }
  };

  return { start, starting };
};
