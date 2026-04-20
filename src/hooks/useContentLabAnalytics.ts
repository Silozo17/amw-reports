import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MrrByTier {
  tier: string;
  org_count: number;
  mrr_gbp: number;
}
export interface RunCompletion {
  industry_slug: string;
  completed: number;
  failed: number;
  total: number;
  completion_rate_pct: number | null;
}
export interface PoolQuality {
  industry_slug: string;
  niche_count: number;
  limited_count: number;
  limited_pct: number | null;
}
export interface ChurnSignal {
  org_id: string;
  org_name: string;
  content_lab_tier: string | null;
  last_run_at: string | null;
  lifetime_runs: number;
  current_credit_balance: number;
  days_since_last_run: number | null;
}
export interface ContentLabAnalytics {
  mrr_by_tier: MrrByTier[];
  run_completion: RunCompletion[];
  pool_quality: PoolQuality[];
  churn_signals: ChurnSignal[];
  regen_rate_avg: number | null;
}

export function useContentLabAnalytics() {
  return useQuery<ContentLabAnalytics>({
    queryKey: ['content-lab-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_content_lab_analytics');
      if (error) throw error;
      return data as unknown as ContentLabAnalytics;
    },
    staleTime: 5 * 60 * 1000,
  });
}
