import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SecurityOverview {
  spendToday: number;
  spendWeek: number;
  spendMonth: number;
  topOrgs: Array<{ org_id: string; org_name: string; spend_pence: number }>;
  freeze: { active: boolean; reason: string | null; at: string | null };
}

const PENCE = (n: unknown) => Number(n ?? 0);

export function useAdminSecurity() {
  return useQuery<SecurityOverview>({
    queryKey: ['admin-security-overview'],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: events }, { data: settings }] = await Promise.all([
        supabase.from('cost_events').select('org_id, amount_pence, created_at').gte('created_at', monthAgo),
        supabase.from('platform_settings').select('spend_freeze_active, spend_freeze_reason, spend_freeze_at').eq('id', true).maybeSingle(),
      ]);

      const rows = events ?? [];
      const sumSince = (since: string) =>
        rows.filter((r) => r.created_at >= since).reduce((acc, r) => acc + PENCE(r.amount_pence), 0);

      const orgTotals = new Map<string, number>();
      for (const r of rows) {
        orgTotals.set(r.org_id, (orgTotals.get(r.org_id) ?? 0) + PENCE(r.amount_pence));
      }
      const topOrgIds = [...orgTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const { data: orgRows } = await supabase
        .from('organisations').select('id, name').in('id', topOrgIds.map(([id]) => id));
      const nameById = new Map((orgRows ?? []).map((o) => [o.id, o.name]));

      return {
        spendToday: sumSince(dayAgo),
        spendWeek: sumSince(weekAgo),
        spendMonth: sumSince(monthAgo),
        topOrgs: topOrgIds.map(([id, pence]) => ({ org_id: id, org_name: nameById.get(id) ?? id, spend_pence: pence })),
        freeze: {
          active: settings?.spend_freeze_active ?? false,
          reason: settings?.spend_freeze_reason ?? null,
          at: settings?.spend_freeze_at ?? null,
        },
      };
    },
    refetchInterval: 60_000,
  });
}

export function useToggleSpendFreeze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: { active: boolean; reason?: string }) => {
      const { error } = await supabase.from('platform_settings').update({
        spend_freeze_active: next.active,
        spend_freeze_reason: next.active ? (next.reason ?? 'Manual freeze by admin') : null,
        spend_freeze_at: next.active ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-security-overview'] }),
  });
}
