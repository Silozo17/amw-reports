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
