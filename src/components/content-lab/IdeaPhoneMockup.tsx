import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Sparkles, Wand2, Copy, Check, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSaveItem } from '@/hooks/useContentLabSaves';

export interface IdeaForMockup {
  id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  hooks?: string[] | null;
  script: string | null;
  caption: string | null;
  cta: string | null;
  hashtags: string[];
  best_fit_platform: string | null;
  why_it_works: string | null;
  visual_direction: string | null;
  like_count?: number | null;
}

interface Props {
  idea: IdeaForMockup;
  runId?: string;
  orgHandle?: string;
  onEdit?: () => void;
}

const IdeaPhoneMockup = ({ idea, runId, orgHandle, onEdit }: Props) => {
  const queryClient = useQueryClient();
  const saveItem = useSaveItem();
  const [hookIdx, setHookIdx] = useState(0);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const hooks = useMemo(() => {
    const list = (idea.hooks ?? []).filter(Boolean);
    if (list.length >= 1) return list.slice(0, 3);
    return idea.hook ? [idea.hook] : [];
  }, [idea.hook, idea.hooks]);

  const { data: reactions = [] } = useQuery({
    queryKey: ['idea-reactions', idea.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_idea_reactions')
        .select('user_id')
        .eq('idea_id', idea.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const liked = !!me && reactions.some((r) => r.user_id === me);
  const likeCount = reactions.length;

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error('Not signed in');
      if (liked) {
        const { error } = await supabase
          .from('content_lab_idea_reactions')
          .delete()
          .eq('idea_id', idea.id)
          .eq('user_id', me);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_lab_idea_reactions')
          .insert({ idea_id: idea.id, user_id: me });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['idea-reactions', idea.id] });
      void queryClient.invalidateQueries({ queryKey: ['cl-run-ideas'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update like'),
  });

  return (
    <Card className="flex flex-col gap-3 p-3">
      {/* Phone frame */}
      <div className="mx-auto w-full max-w-[300px] rounded-[28px] border border-border bg-background p-2 shadow-lg">
        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          {/* IG header */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-400 p-[2px]">
              <div className="h-full w-full rounded-full bg-card" />
            </div>
            <p className="text-xs font-semibold">{orgHandle ?? 'your.brand'}</p>
            <Badge variant="outline" className="ml-auto text-[9px] capitalize">
              {idea.best_fit_platform ?? 'instagram'}
            </Badge>
          </div>

          {/* Visual */}
          <div className="relative aspect-square bg-gradient-to-br from-primary/15 via-background to-accent/10 p-4">
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Hook</p>
                <p className="mt-1 line-clamp-4 text-sm font-display leading-tight">
                  {hooks[hookIdx] ?? idea.title}
                </p>
              </div>
              {idea.visual_direction && (
                <p className="line-clamp-2 text-[10px] italic text-muted-foreground">
                  🎬 {idea.visual_direction}
                </p>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-3 px-3 py-2">
            <button
              type="button"
              onClick={() => toggleLike.mutate()}
              className="flex items-center gap-1 text-xs"
              aria-label={liked ? 'Unlike' : 'Like'}
            >
              <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <CommentSheet ideaId={idea.id} me={me}>
              <button type="button" className="flex items-center gap-1 text-xs" aria-label="Comments">
                <MessageCircle className="h-5 w-5" />
              </button>
            </CommentSheet>
            <ShareDialog idea={idea}>
              <button type="button" className="flex items-center gap-1 text-xs" aria-label="Share">
                <Send className="h-5 w-5" />
              </button>
            </ShareDialog>
            <button
              type="button"
              className="ml-auto"
              aria-label="Save"
              onClick={() => saveItem.mutate({
                kind: 'idea',
                source_run_id: runId ?? null,
                source_id: idea.id,
                payload: { ...idea },
              })}
            >
              <Bookmark className="h-5 w-5" />
            </button>
          </div>

          {/* Caption */}
          {idea.caption && (
            <div className="px-3 pb-3 text-[11px]">
              <span className="font-semibold">{orgHandle ?? 'your.brand'}</span>{' '}
              <span className="text-muted-foreground">{idea.caption}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hook switcher */}
      {hooks.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {hooks.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setHookIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === hookIdx ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
              aria-label={`Hook ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Idea #{idea.idea_number}
          </p>
        </div>
        <h3 className="font-display text-sm leading-tight">{idea.title}</h3>

        <details className="group">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            3 Hooks
          </summary>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px]">
            {hooks.map((h, i) => <li key={i} className={i === hookIdx ? 'font-semibold' : ''}>{h}</li>)}
          </ol>
        </details>

        {idea.script && (
          <details>
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Script
            </summary>
            <p className="mt-1 whitespace-pre-line text-[11px] text-muted-foreground">{idea.script}</p>
          </details>
        )}

        {idea.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {idea.hashtags.slice(0, 6).map((h) => (
              <Badge key={h} variant="secondary" className="text-[9px]">#{h.replace(/^#/, '')}</Badge>
            ))}
          </div>
        )}

        {idea.why_it_works && (
          <div className="rounded-md border border-border/60 bg-muted/40 p-2">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Why it works</p>
            <p className="mt-0.5 text-[11px]">{idea.why_it_works}</p>
          </div>
        )}

        {onEdit && (
          <Button variant="outline" size="sm" className="w-full" onClick={onEdit}>
            <Wand2 className="mr-2 h-3 w-3" /> AI edit
          </Button>
        )}
      </div>
    </Card>
  );
};

const CommentSheet = ({
  children, ideaId, me,
}: { children: React.ReactNode; ideaId: string; me: string | null }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['idea-comments', ideaId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_idea_comments')
        .select('id, body, author_name, created_at, user_id')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error('Sign in required');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Empty comment');
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('user_id', me).maybeSingle();
      const { error } = await supabase.from('content_lab_idea_comments').insert({
        idea_id: ideaId, user_id: me, body: trimmed,
        author_name: prof?.full_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['idea-comments', ideaId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not post comment'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>Anyone with access to this run can read and reply.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet — be the first.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <p className="text-xs font-semibold">{c.author_name ?? 'Team member'}</p>
              <p className="text-muted-foreground">{c.body}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                {new Date(c.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
          />
          <DialogFooter>
            <Button onClick={() => post.mutate()} disabled={post.isPending || !body.trim()}>
              {post.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Post
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ShareDialog = ({ children, idea }: { children: React.ReactNode; idea: IdeaForMockup }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: token, refetch, isFetching } = useQuery({
    queryKey: ['idea-share-token', idea.id],
    enabled: open,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from('content_lab_idea_share_tokens')
        .select('slug')
        .eq('idea_id', idea.id)
        .eq('is_active', true)
        .maybeSingle();
      if (existing?.slug) return existing.slug;

      const { data: ideaRow } = await supabase
        .from('content_lab_ideas')
        .select('run_id')
        .eq('id', idea.id)
        .maybeSingle();
      if (!ideaRow?.run_id) throw new Error('Idea not found');
      const { data: run } = await supabase
        .from('content_lab_runs')
        .select('org_id')
        .eq('id', ideaRow.run_id)
        .maybeSingle();
      if (!run?.org_id) throw new Error('Run org not found');

      const { data: { user } } = await supabase.auth.getUser();
      const slug = `idea-${Math.random().toString(36).slice(2, 8)}-${idea.id.slice(0, 6)}`;
      const { error } = await supabase
        .from('content_lab_idea_share_tokens')
        .insert({ idea_id: idea.id, org_id: run.org_id, slug, created_by: user?.id });
      if (error) throw error;
      return slug;
    },
  });

  const url = token ? `${window.location.origin}/share/idea/${token}` : '';

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this idea</DialogTitle>
          <DialogDescription>
            White-labeled link — anyone with the URL can view (no login required).
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={isFetching ? 'Generating link…' : url}
            className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-xs"
          />
          <Button size="sm" onClick={copy} disabled={!url}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Regenerate
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default IdeaPhoneMockup;
