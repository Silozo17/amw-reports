import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const RUNS_LIMIT = 100;
const PROGRESS_LIMIT = 200;

export interface AdminRunRow {
  id: string;
  status: string;
  current_phase: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  cost_pence: number;
  error_message: string | null;
  org_id: string;
  client_id: string;
  org_name: string;
  client_name: string;
  post_count: number;
  idea_count: number;
}

export interface AdminProgressRow {
  id: string;
  run_id: string;
  phase: string;
  status: string;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface RawOrg { id: string; name: string }
interface RawClient { id: string; company_name: string }

async function fetchOrgClientMaps() {
  const [{ data: orgs }, { data: clients }] = await Promise.all([
    supabase.from('organisations').select('id, name'),
    supabase.from('clients').select('id, company_name'),
  ]);
  const orgMap = new Map<string, string>();
  ((orgs as RawOrg[] | null) ?? []).forEach((o) => orgMap.set(o.id, o.name));
  const clientMap = new Map<string, string>();
  ((clients as RawClient[] | null) ?? []).forEach((c) => clientMap.set(c.id, c.company_name));
  return { orgMap, clientMap };
}

export function useAdminContentLabRuns() {
  return useQuery({
    queryKey: ['admin-content-lab-runs'],
    queryFn: async (): Promise<AdminRunRow[]> => {
      const { data: runs, error } = await supabase
        .from('content_lab_runs')
        .select('id, status, current_phase, started_at, completed_at, created_at, cost_pence, error_message, org_id, client_id')
        .order('created_at', { ascending: false })
        .limit(RUNS_LIMIT);
      if (error) throw error;
      const rows = runs ?? [];
      if (rows.length === 0) return [];
      const runIds = rows.map((r) => r.id);
      const [{ orgMap, clientMap }, postsRes, ideasRes] = await Promise.all([
        fetchOrgClientMaps(),
        supabase.from('content_lab_posts').select('run_id').in('run_id', runIds),
        supabase.from('content_lab_ideas').select('run_id').in('run_id', runIds),
      ]);
      const postCounts = new Map<string, number>();
      (postsRes.data ?? []).forEach((p: { run_id: string }) => postCounts.set(p.run_id, (postCounts.get(p.run_id) ?? 0) + 1));
      const ideaCounts = new Map<string, number>();
      (ideasRes.data ?? []).forEach((i: { run_id: string }) => ideaCounts.set(i.run_id, (ideaCounts.get(i.run_id) ?? 0) + 1));
      return rows.map((r) => ({
        ...r,
        org_name: orgMap.get(r.org_id) ?? 'Unknown',
        client_name: clientMap.get(r.client_id) ?? 'Unknown',
        post_count: postCounts.get(r.id) ?? 0,
        idea_count: ideaCounts.get(r.id) ?? 0,
      }));
    },
    staleTime: 10_000,
  });
}

export function useAdminContentLabProgress(filters: { runId?: string; status?: string; phase?: string } = {}) {
  return useQuery({
    queryKey: ['admin-content-lab-progress', filters],
    queryFn: async (): Promise<AdminProgressRow[]> => {
      let q = supabase
        .from('content_lab_run_progress')
        .select('id, run_id, phase, status, message, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(PROGRESS_LIMIT);
      if (filters.runId) q = q.eq('run_id', filters.runId);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.phase) q = q.eq('phase', filters.phase);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminProgressRow[];
    },
    staleTime: 5_000,
  });
}

export interface RunDetail {
  run: Record<string, unknown> | null;
  posts: Array<Record<string, unknown>>;
  ideas: Array<Record<string, unknown>>;
  progress: AdminProgressRow[];
}

export function useAdminContentLabRunDetail(runId: string | null) {
  return useQuery({
    queryKey: ['admin-content-lab-run-detail', runId],
    enabled: !!runId,
    queryFn: async (): Promise<RunDetail> => {
      if (!runId) throw new Error('No runId');
      const [runRes, postsRes, ideasRes, progressRes] = await Promise.all([
        supabase.from('content_lab_runs').select('*').eq('id', runId).maybeSingle(),
        supabase.from('content_lab_posts').select('*').eq('run_id', runId).order('engagement_rate', { ascending: false }),
        supabase.from('content_lab_ideas').select('*').eq('run_id', runId).order('idea_number', { ascending: true }),
        supabase.from('content_lab_run_progress').select('id, run_id, phase, status, message, payload, created_at').eq('run_id', runId).order('created_at', { ascending: true }),
      ]);
      if (runRes.error) throw runRes.error;
      return {
        run: runRes.data as Record<string, unknown> | null,
        posts: (postsRes.data ?? []) as Array<Record<string, unknown>>,
        ideas: (ideasRes.data ?? []) as Array<Record<string, unknown>>,
        progress: (progressRes.data ?? []) as AdminProgressRow[],
      };
    },
  });
}

export function useAdminContentLabRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('admin-content-lab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_lab_runs' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-content-lab-runs'] });
        qc.invalidateQueries({ queryKey: ['admin-content-lab-run-detail'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_lab_run_progress' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-content-lab-progress'] });
        qc.invalidateQueries({ queryKey: ['admin-content-lab-run-detail'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
