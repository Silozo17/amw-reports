import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const RUNS_LIMIT = 100;
const LOGS_LIMIT = 200;
const NICHES_LIMIT = 200;

export interface AdminRunRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  cost_pence: number;
  error_message: string | null;
  org_id: string;
  client_id: string;
  niche_id: string;
  org_name: string;
  client_name: string;
  niche_label: string;
  post_count: number;
  idea_count: number;
}

export interface AdminStepLog {
  id: string;
  run_id: string;
  step: string;
  status: 'started' | 'ok' | 'failed';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  message: string | null;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

export interface AdminNicheRow {
  id: string;
  label: string;
  org_id: string;
  client_id: string;
  org_name: string;
  client_name: string;
  discovered_at: string | null;
  updated_at: string;
  run_count: number;
  total_cost_pence: number;
  last_run_at: string | null;
}

interface RawOrg { id: string; name: string }
interface RawClient { id: string; company_name: string }

async function fetchOrgClientMaps() {
  const [{ data: orgs }, { data: clients }] = await Promise.all([
    supabase.from('organisations').select('id, name'),
    supabase.from('clients').select('id, company_name'),
  ]);
  const orgMap = new Map<string, string>();
  (orgs as RawOrg[] | null ?? []).forEach((o) => orgMap.set(o.id, o.name));
  const clientMap = new Map<string, string>();
  (clients as RawClient[] | null ?? []).forEach((c) => clientMap.set(c.id, c.company_name));
  return { orgMap, clientMap };
}

export function useAdminContentLabRuns() {
  return useQuery({
    queryKey: ['admin-content-lab-runs'],
    queryFn: async (): Promise<AdminRunRow[]> => {
      const { data: runs, error } = await supabase
        .from('content_lab_runs')
        .select('id, status, started_at, completed_at, created_at, cost_pence, error_message, org_id, client_id, niche_id')
        .order('created_at', { ascending: false })
        .limit(RUNS_LIMIT);
      if (error) throw error;
      const rows = runs ?? [];
      if (rows.length === 0) return [];

      const runIds = rows.map((r) => r.id);
      const nicheIds = Array.from(new Set(rows.map((r) => r.niche_id)));

      const [{ orgMap, clientMap }, postsRes, ideasRes, nichesRes] = await Promise.all([
        fetchOrgClientMaps(),
        supabase.from('content_lab_posts').select('run_id').in('run_id', runIds),
        supabase.from('content_lab_ideas').select('run_id').in('run_id', runIds),
        supabase.from('content_lab_niches').select('id, label').in('id', nicheIds),
      ]);

      const postCounts = new Map<string, number>();
      (postsRes.data ?? []).forEach((p: { run_id: string }) => {
        postCounts.set(p.run_id, (postCounts.get(p.run_id) ?? 0) + 1);
      });
      const ideaCounts = new Map<string, number>();
      (ideasRes.data ?? []).forEach((i: { run_id: string }) => {
        ideaCounts.set(i.run_id, (ideaCounts.get(i.run_id) ?? 0) + 1);
      });
      const nicheMap = new Map<string, string>();
      (nichesRes.data ?? []).forEach((n: { id: string; label: string }) => {
        nicheMap.set(n.id, n.label);
      });

      return rows.map((r) => ({
        ...r,
        org_name: orgMap.get(r.org_id) ?? 'Unknown',
        client_name: clientMap.get(r.client_id) ?? 'Unknown',
        niche_label: nicheMap.get(r.niche_id) ?? 'Unknown',
        post_count: postCounts.get(r.id) ?? 0,
        idea_count: ideaCounts.get(r.id) ?? 0,
      }));
    },
    staleTime: 10_000,
  });
}

export function useAdminContentLabStepLogs(filters: { runId?: string; status?: string; step?: string } = {}) {
  return useQuery({
    queryKey: ['admin-content-lab-step-logs', filters],
    queryFn: async (): Promise<AdminStepLog[]> => {
      let q = supabase
        .from('content_lab_step_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(LOGS_LIMIT);
      if (filters.runId) q = q.eq('run_id', filters.runId);
      if (filters.status) q = q.eq('status', filters.status as 'started' | 'ok' | 'failed');
      if (filters.step) q = q.eq('step', filters.step);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminStepLog[];
    },
    staleTime: 5_000,
  });
}

export function useAdminContentLabNiches() {
  return useQuery({
    queryKey: ['admin-content-lab-niches'],
    queryFn: async (): Promise<AdminNicheRow[]> => {
      const { data: niches, error } = await supabase
        .from('content_lab_niches')
        .select('id, label, org_id, client_id, discovered_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(NICHES_LIMIT);
      if (error) throw error;
      const rows = niches ?? [];
      if (rows.length === 0) return [];

      const [{ orgMap, clientMap }, runsRes] = await Promise.all([
        fetchOrgClientMaps(),
        supabase
          .from('content_lab_runs')
          .select('niche_id, cost_pence, created_at')
          .in('niche_id', rows.map((n) => n.id)),
      ]);

      const stats = new Map<string, { count: number; cost: number; last: string | null }>();
      (runsRes.data ?? []).forEach((r: { niche_id: string; cost_pence: number; created_at: string }) => {
        const cur = stats.get(r.niche_id) ?? { count: 0, cost: 0, last: null };
        cur.count += 1;
        cur.cost += r.cost_pence ?? 0;
        if (!cur.last || r.created_at > cur.last) cur.last = r.created_at;
        stats.set(r.niche_id, cur);
      });

      return rows.map((n) => {
        const s = stats.get(n.id) ?? { count: 0, cost: 0, last: null };
        return {
          ...n,
          org_name: orgMap.get(n.org_id) ?? 'Unknown',
          client_name: clientMap.get(n.client_id) ?? 'Unknown',
          run_count: s.count,
          total_cost_pence: s.cost,
          last_run_at: s.last,
        };
      });
    },
    staleTime: 30_000,
  });
}

export interface RunDetail {
  run: Record<string, unknown> | null;
  niche: Record<string, unknown> | null;
  posts: Array<Record<string, unknown>>;
  ideas: Array<Record<string, unknown>>;
  stepLogs: AdminStepLog[];
}

export function useAdminContentLabRunDetail(runId: string | null) {
  return useQuery({
    queryKey: ['admin-content-lab-run-detail', runId],
    enabled: !!runId,
    queryFn: async (): Promise<RunDetail> => {
      if (!runId) throw new Error('No runId');
      const [runRes, postsRes, ideasRes, logsRes] = await Promise.all([
        supabase.from('content_lab_runs').select('*').eq('id', runId).single(),
        supabase.from('content_lab_posts').select('*').eq('run_id', runId).order('engagement_rate', { ascending: false }),
        supabase.from('content_lab_ideas').select('*').eq('run_id', runId).order('idea_number', { ascending: true }),
        supabase.from('content_lab_step_logs').select('*').eq('run_id', runId).order('created_at', { ascending: true }),
      ]);
      if (runRes.error) throw runRes.error;
      let niche: Record<string, unknown> | null = null;
      const nicheId = (runRes.data as { niche_id?: string } | null)?.niche_id;
      if (nicheId) {
        const { data } = await supabase.from('content_lab_niches').select('*').eq('id', nicheId).single();
        niche = data as Record<string, unknown> | null;
      }
      return {
        run: runRes.data as Record<string, unknown> | null,
        niche,
        posts: (postsRes.data ?? []) as Array<Record<string, unknown>>,
        ideas: (ideasRes.data ?? []) as Array<Record<string, unknown>>,
        stepLogs: (logsRes.data ?? []) as AdminStepLog[],
      };
    },
  });
}

/** Subscribe to realtime changes on runs + step logs and invalidate the relevant queries. */
export function useAdminContentLabRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('admin-content-lab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_lab_runs' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-content-lab-runs'] });
        qc.invalidateQueries({ queryKey: ['admin-content-lab-run-detail'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_lab_step_logs' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-content-lab-step-logs'] });
        qc.invalidateQueries({ queryKey: ['admin-content-lab-run-detail'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
