import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

export interface IdeaComment {
  id: string;
  idea_id: string;
  org_id: string;
  author_user_id: string | null;
  author_client_user_id: string | null;
  author_label: string;
  body: string;
  created_at: string;
}

export const useIdeaComments = (ideaId: string | null | undefined) => {
  return useQuery<IdeaComment[]>({
    queryKey: ['idea-comments', ideaId],
    enabled: !!ideaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_idea_comments')
        .select('*')
        .eq('idea_id', ideaId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as IdeaComment[];
    },
  });
};

export const useIdeaCommentCount = (ideaId: string | null | undefined) => {
  return useQuery<number>({
    queryKey: ['idea-comment-count', ideaId],
    enabled: !!ideaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('content_lab_idea_comments')
        .select('*', { count: 'exact', head: true })
        .eq('idea_id', ideaId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
};

interface PostArgs {
  ideaId: string;
  body: string;
}

export const usePostIdeaComment = () => {
  const { user, profile, isClientUser } = useAuth();
  const { orgId } = useOrg();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ideaId, body }: PostArgs) => {
      if (!user?.id) throw new Error('Not signed in');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Comment cannot be empty');

      // For org members we need orgId; for client users we resolve org via the idea's run.
      let resolvedOrgId = orgId;
      if (!resolvedOrgId) {
        const { data: ideaRow, error: ideaErr } = await supabase
          .from('content_lab_ideas')
          .select('content_lab_runs!inner ( org_id )')
          .eq('id', ideaId)
          .single();
        if (ideaErr) throw ideaErr;
        resolvedOrgId = (ideaRow as { content_lab_runs: { org_id: string } }).content_lab_runs.org_id;
      }

      const label = profile?.full_name || profile?.email || 'Client';
      const { error } = await supabase.from('content_lab_idea_comments').insert({
        idea_id: ideaId,
        org_id: resolvedOrgId,
        author_user_id: isClientUser ? null : user.id,
        author_client_user_id: isClientUser ? user.id : null,
        author_label: label,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: (_d, { ideaId }) => {
      qc.invalidateQueries({ queryKey: ['idea-comments', ideaId] });
      qc.invalidateQueries({ queryKey: ['idea-comment-count', ideaId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to post comment'),
  });
};
