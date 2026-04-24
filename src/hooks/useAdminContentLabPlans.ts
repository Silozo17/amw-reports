import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminOrgContentLabRow {
  org_id: string;
  org_name: string;
  tier: string | null;
  status: string | null;
  credits_balance: number;
  runs_this_month: number;
}

const QUERY_KEY = ['admin-content-lab-plans'] as const;

export function useAdminOrgContentLabRows() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AdminOrgContentLabRow[]> => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;

      const [orgsRes, subsRes, creditsRes, usageRes] = await Promise.all([
        supabase.from('organisations').select('id, name').order('name'),
        supabase.from('org_subscriptions').select('org_id, content_lab_tier, status'),
        supabase.from('content_lab_credits').select('org_id, balance'),
        supabase
          .from('content_lab_usage')
          .select('org_id, runs_count')
          .eq('year', year)
          .eq('month', month),
      ]);

      if (orgsRes.error) throw orgsRes.error;

      const subMap = new Map<string, { tier: string | null; status: string | null }>();
      ((subsRes.data ?? []) as Array<{ org_id: string; content_lab_tier: string | null; status: string | null }>).forEach((s) => {
        subMap.set(s.org_id, { tier: s.content_lab_tier, status: s.status });
      });
      const creditMap = new Map<string, number>();
      ((creditsRes.data ?? []) as Array<{ org_id: string; balance: number }>).forEach((c) => {
        creditMap.set(c.org_id, c.balance);
      });
      const usageMap = new Map<string, number>();
      ((usageRes.data ?? []) as Array<{ org_id: string; runs_count: number }>).forEach((u) => {
        usageMap.set(u.org_id, u.runs_count);
      });

      return ((orgsRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => ({
        org_id: o.id,
        org_name: o.name,
        tier: subMap.get(o.id)?.tier ?? null,
        status: subMap.get(o.id)?.status ?? null,
        credits_balance: creditMap.get(o.id) ?? 0,
        runs_this_month: usageMap.get(o.id) ?? 0,
      }));
    },
    staleTime: 15_000,
  });
}

export function useSetContentLabTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, tier }: { orgId: string; tier: string | null }) => {
      const { error } = await supabase.rpc('admin_set_content_lab_tier', {
        _org_id: orgId,
        _tier: tier,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tier updated');
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdjustContentLabCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, delta, reason }: { orgId: string; delta: number; reason: string }) => {
      const { error } = await supabase.rpc('admin_adjust_content_lab_credits', {
        _org_id: orgId,
        _delta: delta,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.delta > 0 ? `Granted ${vars.delta} credits` : `Revoked ${Math.abs(vars.delta)} credits`);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
