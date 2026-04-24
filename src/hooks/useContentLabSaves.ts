import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/contexts/OrgContext';

export type SaveKind = 'idea' | 'post' | 'hook';

export interface SavedItem {
  id: string;
  org_id: string;
  saved_by: string | null;
  kind: SaveKind;
  source_run_id: string | null;
  source_id: string | null;
  payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface HookEntry {
  id: string;
  org_id: string;
  hook_text: string;
  hook_type: string | null;
  platform: string | null;
  source_post_id: string | null;
  example_caption: string | null;
  example_post_url: string | null;
  created_at: string;
}

export interface TrendEntry {
  id: string;
  org_id: string;
  label: string;
  description: string | null;
  evidence: Array<Record<string, unknown>>;
  source_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useSaves = (kind?: SaveKind) => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['content-lab-saves', orgId, kind ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('content_lab_saves').select('*').eq('org_id', orgId!).order('created_at', { ascending: false });
      if (kind) q = q.eq('kind', kind);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SavedItem[];
    },
  });
};

export const useHooks = () => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['content-lab-hooks', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_hooks')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HookEntry[];
    },
  });
};

export const useTrends = () => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['content-lab-trends', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_trends')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrendEntry[];
    },
  });
};

interface SaveItemArgs {
  kind: SaveKind;
  source_run_id?: string | null;
  source_id?: string | null;
  payload: Record<string, unknown>;
}

export const useSaveItem = () => {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SaveItemArgs) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase.from('content_lab_saves').insert({
        org_id: orgId,
        saved_by: user?.id ?? null,
        kind: args.kind,
        source_run_id: args.source_run_id ?? null,
        source_id: args.source_id ?? null,
        payload: args.payload,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Saved ${vars.kind} to your library`);
      void qc.invalidateQueries({ queryKey: ['content-lab-saves', orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save'),
  });
};

interface SaveHookArgs {
  hook_text: string;
  hook_type?: string | null;
  platform?: string | null;
  source_post_id?: string | null;
  example_caption?: string | null;
  example_post_url?: string | null;
}

export const useSaveHook = () => {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SaveHookArgs) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase.from('content_lab_hooks').upsert(
        {
          org_id: orgId,
          saved_by: user?.id ?? null,
          hook_text: args.hook_text,
          hook_type: args.hook_type ?? null,
          platform: args.platform ?? null,
          source_post_id: args.source_post_id ?? null,
          example_caption: args.example_caption ?? null,
          example_post_url: args.example_post_url ?? null,
        },
        { onConflict: 'org_id,hook_text', ignoreDuplicates: false },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Hook added to library');
      void qc.invalidateQueries({ queryKey: ['content-lab-hooks', orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save hook'),
  });
};

export const useDeleteSave = () => {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('content_lab_saves').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: ['content-lab-saves', orgId] });
    },
  });
};

export const useDeleteHook = () => {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('content_lab_hooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: ['content-lab-hooks', orgId] });
    },
  });
};

export const useDeleteTrend = () => {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('content_lab_trends').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: ['content-lab-trends', orgId] });
    },
  });
};
