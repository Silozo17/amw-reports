import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SwipeFileEntry {
  id: string;
  idea_id: string;
  org_id: string;
  client_id: string | null;
  niche_id: string | null;
  saved_at: string;
  notes: string | null;
  tags: string[];
}

export interface SwipeFileIdea extends SwipeFileEntry {
  idea: {
    id: string;
    title: string;
    hook: string | null;
    caption: string | null;
    target_platform: string | null;
    hashtags: string[];
    is_wildcard: boolean;
    visual_direction: string | null;
    rating: number | null;
    run_id: string;
  } | null;
  client: { id: string; company_name: string } | null;
  niche: { id: string; label: string } | null;
}

/** Returns set of idea_ids saved by current org (lightweight — for heart toggles). */
export const useSwipeFileIds = () => {
  const { orgId } = useOrg();
  return useQuery({
    queryKey: ['swipe-file-ids', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_swipe_file')
        .select('idea_id')
        .eq('org_id', orgId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.idea_id));
    },
  });
};

/** Full swipe file with joined idea/client/niche data — for the swipe-file page. */
export const useSwipeFile = () => {
  const { orgId } = useOrg();
  return useQuery<SwipeFileIdea[]>({
    queryKey: ['swipe-file', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_swipe_file')
        .select(`
          id, idea_id, org_id, client_id, niche_id, saved_at, notes, tags,
          idea:content_lab_ideas!content_lab_swipe_file_idea_id_fkey (
            id, title, hook, caption, target_platform, hashtags, is_wildcard,
            visual_direction, rating, run_id
          ),
          client:clients (id, company_name),
          niche:content_lab_niches (id, label)
        `)
        .eq('org_id', orgId!)
        .order('saved_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SwipeFileIdea[];
    },
  });
};

interface ToggleArgs {
  ideaId: string;
  clientId?: string | null;
  nicheId?: string | null;
  isSaved: boolean;
}

export const useToggleSwipe = () => {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ideaId, clientId, nicheId, isSaved }: ToggleArgs) => {
      if (!orgId || !user?.id) throw new Error('Not signed in');
      if (isSaved) {
        const { error } = await supabase
          .from('content_lab_swipe_file')
          .delete()
          .eq('org_id', orgId)
          .eq('idea_id', ideaId);
        if (error) throw error;
        return { saved: false };
      }
      const { error } = await supabase.from('content_lab_swipe_file').insert({
        org_id: orgId,
        idea_id: ideaId,
        client_id: clientId ?? null,
        niche_id: nicheId ?? null,
        saved_by_user_id: user.id,
      });
      if (error) throw error;
      return { saved: true };
    },
    onSuccess: ({ saved }) => {
      qc.invalidateQueries({ queryKey: ['swipe-file-ids', orgId] });
      qc.invalidateQueries({ queryKey: ['swipe-file', orgId] });
      toast.success(saved ? 'Saved to swipe file' : 'Removed from swipe file');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  });
};
