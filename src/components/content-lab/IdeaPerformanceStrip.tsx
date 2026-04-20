import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, Check, X, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface IdeaPerformanceStripProps {
  ideaId: string;
  runId: string;
  status: string;
  linkedPostId: string | null;
  actualViews: number | null;
  actualEngagementRate: number | null;
}

interface SuggestionPost {
  id: string;
  thumbnail_url: string | null;
  caption: string | null;
  views: number;
  engagement_rate: number;
  post_url: string | null;
  posted_at: string | null;
}

interface Suggestion {
  post: SuggestionPost;
  score: number;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

/**
 * Auto-suggest + user-confirm matcher between an idea and a real scraped own post.
 * Visible only when status is 'filming' or 'posted'.
 */
const IdeaPerformanceStrip = ({
  ideaId,
  runId,
  status,
  linkedPostId,
  actualViews,
  actualEngagementRate,
}: IdeaPerformanceStripProps) => {
  const queryClient = useQueryClient();
  const isEligible = status === 'filming' || status === 'posted';
  const [confirming, setConfirming] = useState(false);

  const { data: linkedPost } = useQuery<SuggestionPost | null>({
    queryKey: ['content-lab-linked-post', linkedPostId],
    enabled: !!linkedPostId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('id, thumbnail_url, caption, views, engagement_rate, post_url, posted_at')
        .eq('id', linkedPostId!)
        .maybeSingle();
      if (error) throw error;
      return (data as SuggestionPost | null) ?? null;
    },
  });

  const { data: suggestion, isLoading: suggestionLoading } = useQuery<Suggestion | null>({
    queryKey: ['content-lab-link-suggest', ideaId],
    enabled: isEligible && !linkedPostId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('content-lab-link-suggest', {
        body: { ideaId },
      });
      if (error) throw error;
      return (data?.suggestion as Suggestion | null) ?? null;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['content-lab-ideas', runId] });
    queryClient.invalidateQueries({ queryKey: ['content-lab-all-ideas'] });
    queryClient.invalidateQueries({ queryKey: ['content-lab-link-suggest', ideaId] });
    queryClient.invalidateQueries({ queryKey: ['content-lab-linked-post'] });
  };

  const confirmMatch = async (postId: string, post: SuggestionPost) => {
    setConfirming(true);
    try {
      const { error } = await supabase
        .from('content_lab_ideas')
        .update({
          linked_post_id: postId,
          linked_at: new Date().toISOString(),
          actual_views: post.views,
          actual_engagement_rate: post.engagement_rate,
        })
        .eq('id', ideaId);
      if (error) throw error;
      toast.success('Match confirmed — performance attached');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save link');
    } finally {
      setConfirming(false);
    }
  };

  const rejectSuggestion = async () => {
    queryClient.setQueryData(['content-lab-link-suggest', ideaId], null);
  };

  const unlink = async () => {
    setConfirming(true);
    try {
      const { error } = await supabase
        .from('content_lab_ideas')
        .update({
          linked_post_id: null,
          linked_at: null,
          actual_views: null,
          actual_engagement_rate: null,
        })
        .eq('id', ideaId);
      if (error) throw error;
      refresh();
    } finally {
      setConfirming(false);
    }
  };

  if (!isEligible) return null;

  if (linkedPostId && linkedPost) {
    return (
      <Card className="flex items-center gap-3 border-primary/30 bg-primary/5 p-3">
        <Thumb url={linkedPost.thumbnail_url} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Linked post</p>
          <p className="truncate text-xs text-muted-foreground">{linkedPost.caption ?? 'No caption'}</p>
          <p className="mt-1 text-xs">
            <span className="font-semibold">{fmt(actualViews ?? linkedPost.views)}</span> views
            {' · '}
            <span className="font-semibold">{((actualEngagementRate ?? linkedPost.engagement_rate) * 100).toFixed(1)}%</span> ER
          </p>
        </div>
        {linkedPost.post_url && (
          <Button variant="ghost" size="sm" asChild>
            <a href={linkedPost.post_url} target="_blank" rel="noreferrer">
              <LinkIcon className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={unlink} disabled={confirming}>
          Unlink
        </Button>
      </Card>
    );
  }

  if (suggestionLoading) {
    return (
      <Card className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching for matching post…
      </Card>
    );
  }

  if (!suggestion) return null;

  return (
    <Card className="flex items-center gap-3 border-dashed p-3">
      <Thumb url={suggestion.post.thumbnail_url} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Suggested match · {Math.round(suggestion.score * 100)}% confidence
        </p>
        <p className="truncate text-xs">{suggestion.post.caption ?? 'No caption'}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {fmt(suggestion.post.views)} views · {(suggestion.post.engagement_rate * 100).toFixed(1)}% ER
        </p>
      </div>
      <Button size="sm" onClick={() => confirmMatch(suggestion.post.id, suggestion.post)} disabled={confirming}>
        <Check className="mr-1 h-3.5 w-3.5" /> Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={rejectSuggestion} disabled={confirming}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
};

const Thumb = ({ url }: { url: string | null }) =>
  url ? (
    <img src={url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );

export default IdeaPerformanceStrip;
