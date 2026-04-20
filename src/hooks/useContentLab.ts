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
  niche_tag: string | null;
  platforms_to_scrape: string[];
  pool_status: string;
  created_at: string;
  updated_at: string;
}

export interface ContentLabRun {
  id: string;
  client_id: string;
  org_id: string;
  niche_id: string;
  niche_tag?: string | null;
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

import { runLimitForTier } from '@/lib/contentLabPricing';

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

export interface FlatIdea {
  id: string;
  run_id: string;
  client_id: string;
  client_name: string;
  niche_label: string;
  idea_number: number;
  title: string;
  hook: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
  created_at: string;
  linked_post_id: string | null;
  actual_views: number | null;
  actual_engagement_rate: number | null;
}

interface IdeaJoinedRow {
  id: string;
  run_id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
  created_at: string;
  linked_post_id: string | null;
  actual_views: number | null;
  actual_engagement_rate: number | null;
  content_lab_runs: {
    client_id: string;
    clients: { company_name: string } | null;
    content_lab_niches: { label: string } | null;
  } | null;
}

/** Flat list of every idea generated for the org, with client + niche labels joined. */
export const useAllIdeas = (clientId?: string) => {
  const { orgId } = useOrg();

  return useQuery<FlatIdea[]>({
    queryKey: ['content-lab-all-ideas', orgId, clientId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('content_lab_ideas')
        .select(
          `id, run_id, idea_number, title, hook, target_platform, rating, status, created_at,
           linked_post_id, actual_views, actual_engagement_rate,
           content_lab_runs!inner (
             client_id, org_id,
             clients ( company_name ),
             content_lab_niches ( label )
           )`,
        )
        .eq('content_lab_runs.org_id', orgId!)
        .order('created_at', { ascending: false });

      if (clientId) q = q.eq('content_lab_runs.client_id', clientId);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as IdeaJoinedRow[]).map((row) => ({
        id: row.id,
        run_id: row.run_id,
        client_id: row.content_lab_runs?.client_id ?? '',
        client_name: row.content_lab_runs?.clients?.company_name ?? 'Unknown client',
        niche_label: row.content_lab_runs?.content_lab_niches?.label ?? 'Untitled niche',
        idea_number: row.idea_number,
        title: row.title,
        hook: row.hook,
        target_platform: row.target_platform,
        rating: row.rating,
        status: row.status,
        created_at: row.created_at,
        linked_post_id: row.linked_post_id,
        actual_views: row.actual_views,
        actual_engagement_rate: row.actual_engagement_rate,
      }));
    },
  });
};

export interface ClientRunGroup {
  clientId: string;
  clientName: string;
  runs: ContentLabRun[];
  latestAt: string;
}

/** Groups runs by client and sorts by most-recent-run-per-client. */
export const useGroupedRuns = () => {
  const { orgId } = useOrg();

  return useQuery<ClientRunGroup[]>({
    queryKey: ['content-lab-grouped-runs', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_runs')
        .select('*, clients ( company_name )')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const map = new Map<string, ClientRunGroup>();
      for (const row of (data ?? []) as Array<ContentLabRun & { clients: { company_name: string } | null }>) {
        const existing = map.get(row.client_id);
        const clientName = row.clients?.company_name ?? 'Unknown client';
        if (existing) {
          existing.runs.push(row);
        } else {
          map.set(row.client_id, { clientId: row.client_id, clientName, runs: [row], latestAt: row.created_at });
        }
      }
      return [...map.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    },
  });
};
