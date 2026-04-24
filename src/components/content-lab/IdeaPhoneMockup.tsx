import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight, Wand2, Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSaveItem } from '@/hooks/useContentLabSaves';

export interface MockupIdea {
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
  edit_count: number;
  like_count: number;
}

interface Props {
  idea: MockupIdea;
  runId?: string;
  handle: string;
  onEdit: () => void;
}

const IdeaPhoneMockup = ({ idea, runId, handle, onEdit }: Props) => {
  const queryClient = useQueryClient();
  const saveItem = useSaveItem();
  const [me, setMe] = useState<string | null>(null);
  const [hookIndex, setHookIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const hooks = (Array.isArray(idea.hooks) && idea.hooks.length > 0)
    ? idea.hooks
    : (idea.hook ? [idea.hook] : ['Your hook here']);
  const currentHook = hooks[hookIndex % hooks.length];

  const { data: liked = false } = useQuery({
    queryKey: ['idea-liked', idea.id, me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_idea_reactions')
        .select('id').eq('idea_id', idea.id).eq('user_id', me!).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error('Sign in to like');
      if (liked) {
        const { error } = await supabase
          .from('content_lab_idea_reactions')
          .delete().eq('idea_id', idea.id).eq('user_id', me);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_lab_idea_reactions')
          .insert({ idea_id: idea.id, user_id: me });
        if (error) throw error;
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['idea-liked', idea.id, me] });
      const prev = queryClient.getQueryData(['idea-liked', idea.id, me]);
      queryClient.setQueryData(['idea-liked', idea.id, me], !liked);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(['idea-liked', idea.id, me], ctx.prev);
      toast.error(e instanceof Error ? e.message : 'Could not update like');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['idea-liked', idea.id, me] });
      void queryClient.invalidateQueries({ queryKey: ['cl-run-ideas'] });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Phone frame */}
      <div className="relative mx-auto w-full max-w-[300px] rounded-[2rem] border-[10px] border-foreground/90 bg-background shadow-xl overflow-hidden">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-foreground/90" />

        {/* IG header */}
        <div className="flex items-center gap-2 px-3 pt-6 pb-2 border-b border-border">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 p-[2px]">
            <div className="h-full w-full rounded-full bg-background" />
          </div>
          <span className="text-xs font-semibold truncate">{handle}</span>
          <Badge variant="outline" className="ml-auto text-[8px] capitalize">
            {idea.best_fit_platform ?? 'reel'}
          </Badge>
        </div>

        {/* Visual / hook */}
        <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/20 via-muted to-accent/20 flex items-center justify-center p-4 text-center">
          <p className="font-display text-base leading-tight text-foreground drop-shadow-sm">
            {currentHook}
          </p>

          {/* Hook swiper */}
          {hooks.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setHookIndex((i) => (i - 1 + hooks.length) % hooks.length)}
                className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 hover:bg-background"
                aria-label="Previous hook"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setHookIndex((i) => (i + 1) % hooks.length)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 hover:bg-background"
                aria-label="Next hook"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {hooks.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-1 rounded-full ${i === hookIndex ? 'bg-foreground' : 'bg-foreground/30'}`}
                  />
                ))}
              </div>
            </>
          )}

          <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider">
            Hook {hookIndex + 1}/{hooks.length}
          </span>
        </div>

        {/* IG action bar */}
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            onClick={() => toggleLike.mutate()}
            disabled={toggleLike.isPending || !me}
            className="transition-transform active:scale-90"
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowComments(true)}
            aria-label="Comment"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            aria-label="Share"
          >
            <Send className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => saveItem.mutate({
              kind: 'idea',
              source_run_id: runId ?? null,
              source_id: idea.id,
              payload: { ...idea },
            })}
            className="ml-auto"
            aria-label="Save"
          >
            <Bookmark className="h-5 w-5" />
          </button>
        </div>

        {/* Likes + caption */}
        <div className="px-3 pb-3 space-y-1">
          <p className="text-xs font-semibold">{(idea.like_count ?? 0).toLocaleString()} likes</p>
          {idea.caption && (
            <p className="text-[11px]">
              <span className="font-semibold">{handle} </span>
              <span className="text-muted-foreground">{idea.caption}</span>
            </p>
          )}
          {idea.hashtags?.length > 0 && (
            <p className="text-[10px] text-primary line-clamp-1">
              {idea.hashtags.slice(0, 6).map((h) => `#${h}`).join(' ')}
            </p>
          )}
        </div>
      </div>

      {/* Title + actions outside phone */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Idea #{idea.idea_number}
            </p>
            <h3 className="font-display text-sm leading-tight">{idea.title}</h3>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDetails(true)}>
            View script & why it works
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} title="AI edit">
            <Wand2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <CommentsDialog open={showComments} onOpenChange={setShowComments} ideaId={idea.id} me={me} />
      <ShareDialog open={showShare} onOpenChange={setShowShare} ideaId={idea.id} />
      <DetailsDialog open={showDetails} onOpenChange={setShowDetails} idea={idea} />
    </div>
  );
};

/* ---------------- Comments dialog ---------------- */

interface CommentRow {
  id: string; body: string; author_name: string | null;
  created_at: string; user_id: string;
}

const CommentsDialog = ({
  open, onOpenChange, ideaId, me,
}: { open: boolean; onOpenChange: (o: boolean) => void; ideaId: string; me: string | null }) => {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments = [], isLoading } = useQuery<CommentRow[]>({
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

  const addComment = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error('Sign in to comment');
      const text = body.trim();
      if (!text) throw new Error('Empty comment');
      const { error } = await supabase
        .from('content_lab_idea_comments')
        .insert({ idea_id: ideaId, user_id: me, body: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['idea-comments', ideaId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not post comment'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>
            Anyone with access to this run can read and reply.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet — be first.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <p className="text-xs font-semibold">
                {c.author_name ?? 'Team member'}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </p>
              <p className="text-sm whitespace-pre-line">{c.body}</p>
            </div>
          ))}
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a comment for the team or your client…"
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => addComment.mutate()} disabled={!body.trim() || addComment.isPending}>
            {addComment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Share dialog ---------------- */

const ShareDialog = ({
  open, onOpenChange, ideaId,
}: { open: boolean; onOpenChange: (o: boolean) => void; ideaId: string }) => {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: token, isLoading } = useQuery({
    queryKey: ['idea-share-token', ideaId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_idea_share_tokens')
        .select('slug, is_active')
        .eq('idea_id', ideaId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const { data: idea, error: e1 } = await supabase
        .from('content_lab_ideas')
        .select('id, run_id, content_lab_runs!inner(org_id)')
        .eq('id', ideaId)
        .maybeSingle();
      if (e1 || !idea) throw e1 ?? new Error('Idea not found');
      const orgId = (idea as unknown as { content_lab_runs: { org_id: string } }).content_lab_runs.org_id;
      const slug = `idea-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('content_lab_idea_share_tokens')
        .insert({ idea_id: ideaId, org_id: orgId, slug, created_by: user?.id ?? null });
      if (error) throw error;
      return slug;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['idea-share-token', ideaId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create link'),
  });

  const slug = token?.slug ?? null;
  const url = slug ? `${window.location.origin}/share/idea/${slug}` : null;

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this idea with a client</DialogTitle>
          <DialogDescription>
            White-labelled link styled with your branding. No login required for the viewer.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : url ? (
          <div className="flex gap-2">
            <Input value={url} readOnly />
            <Button onClick={handleCopy} variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <Button onClick={() => createToken.mutate()} disabled={createToken.isPending}>
            {createToken.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create share link
          </Button>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Details dialog ---------------- */

const DetailsDialog = ({
  open, onOpenChange, idea,
}: { open: boolean; onOpenChange: (o: boolean) => void; idea: MockupIdea }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{idea.title}</DialogTitle>
        <DialogDescription>
          Idea #{idea.idea_number}
          {idea.best_fit_platform && <> · {idea.best_fit_platform}</>}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {Array.isArray(idea.hooks) && idea.hooks.length > 0 && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">3 hook variations</h4>
            <ol className="list-decimal pl-5 space-y-1">
              {idea.hooks.map((h, i) => <li key={i} className="text-sm">{h}</li>)}
            </ol>
          </section>
        )}
        {idea.script && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Script idea</h4>
            <p className="text-sm whitespace-pre-line">{idea.script}</p>
          </section>
        )}
        {idea.caption && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Caption</h4>
            <p className="text-sm whitespace-pre-line">{idea.caption}</p>
          </section>
        )}
        {idea.cta && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">CTA</h4>
            <p className="text-sm">{idea.cta}</p>
          </section>
        )}
        {idea.hashtags?.length > 0 && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Hashtags</h4>
            <div className="flex flex-wrap gap-1">
              {idea.hashtags.map((h) => (
                <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
              ))}
            </div>
          </section>
        )}
        {idea.why_it_works && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Why it works (with credibility)</h4>
            <p className="text-sm whitespace-pre-line">{idea.why_it_works}</p>
          </section>
        )}
        {idea.visual_direction && (
          <section>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Visual direction</h4>
            <p className="text-sm whitespace-pre-line">{idea.visual_direction}</p>
          </section>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default IdeaPhoneMockup;
