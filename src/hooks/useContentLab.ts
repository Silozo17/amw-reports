import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';

export interface ContentLabNiche {
  id: string;
  client_id: string;
  org_id: string;
  label: string;
  tracked_handles: Array<{ platform: string; handle: string }>;
  tracked_hashtags: string[];
  tracked_keywords: string[];
  competitor_urls: string[];
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ContentLabRun {
  id: string;
  client_id: string;
  org_id: string;
  niche_id: string;
  status: 'pending' | 'scraping' | 'analysing' | 'ideating' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  pdf_storage_path: string | null;
  summary: Record<string, unknown>;
  cost_pence: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const useContentLabNiches = (clientId?: string) => {
  const { orgId } = useOrg();

  return useQuery({
    queryKey: ['content-lab-niches', orgId, clientId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('content_lab_niches')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (clientId) q = q.eq('client_id', clientId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ContentLabNiche[];
    },
  });
};

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
        .limit(20);

      if (clientId) q = q.eq('client_id', clientId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ContentLabRun[];
    },
  });
};

const RUN_LIMITS_BY_TIER: Record<string, number> = {
  creator: 1,
  studio: 3,
  agency: 10,
};
const DEFAULT_RUN_LIMIT = 1;

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
      const tier = (subRes.data as { content_lab_tier?: string | null } | null)?.content_lab_tier?.toLowerCase();
      const runsLimit = (tier && RUN_LIMITS_BY_TIER[tier]) ?? DEFAULT_RUN_LIMIT;
      const creditBalance = (credRes.data as { balance?: number } | null)?.balance ?? 0;
      return { runsThisMonth, runsLimit, creditBalance };
    },
  });
};
