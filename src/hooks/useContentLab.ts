import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { runLimitForTier } from '@/lib/contentLabPricing';

export type ContentLabRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ContentLabRun {
  id: string;
  client_id: string;
  org_id: string;
  status: ContentLabRunStatus;
  current_phase: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: Record<string, unknown>;
  cost_pence: number;
  error_message: string | null;
  client_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const useContentLabRuns = (clientId?: string) => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['content-lab-runs', orgId, clientId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('content_lab_runs')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ContentLabRun[];
    },
  });
};

export interface ContentLabUsage {
  runsThisMonth: number;
  runsLimit: number;
  creditBalance: number;
}

export const useContentLabUsage = () => {
  const { orgId } = useOrg();
  return useQuery<ContentLabUsage>({
    queryKey: ['content-lab-usage', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const now = new Date();
      const [usageRes, subRes, credRes] = await Promise.all([
        supabase
          .from('content_lab_usage')
          .select('runs_count')
          .eq('org_id', orgId!)
          .eq('year', now.getUTCFullYear())
          .eq('month', now.getUTCMonth() + 1)
          .maybeSingle(),
        supabase
          .from('org_subscriptions')
          .select('content_lab_tier')
          .eq('org_id', orgId!)
          .maybeSingle(),
        supabase
          .from('content_lab_credits')
          .select('balance')
          .eq('org_id', orgId!)
          .maybeSingle(),
      ]);
      const runsThisMonth = (usageRes.data as { runs_count?: number } | null)?.runs_count ?? 0;
      const tier = (subRes.data as { content_lab_tier?: string | null } | null)?.content_lab_tier ?? null;
      const runsLimit = runLimitForTier(tier);
      const creditBalance = (credRes.data as { balance?: number } | null)?.balance ?? 0;
      return { runsThisMonth, runsLimit, creditBalance };
    },
  });
};

export interface ClientForPicker {
  id: string;
  company_name: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  competitors: string | null;
  social_handles: Record<string, unknown> | null;
}

export const useClientsForPicker = () => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['content-lab-client-picker', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, industry, location, website, competitors, social_handles')
        .eq('org_id', orgId!)
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return (data ?? []) as unknown as ClientForPicker[];
    },
  });
};
