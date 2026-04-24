import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight,
  Wand2, Sparkles, Copy, Check, Loader2, ExternalLink, Eye, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSaveItem } from '@/hooks/useContentLabSaves';
import IgThumb from '@/components/content-lab/IgThumb';

const HOOK_AUTOROTATE_MS = 4000;

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
  inspired_by_post_id?: string | null;
  inspiration_source?: string | null;
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
  const [autoRotate, setAutoRotate] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const hooks = (Array.isArray(idea.hooks) && idea.hooks.length > 0)
    ? idea.hooks
    : (idea.hook ? [idea.hook] : ['Your hook here']);
  const currentHook = hooks[hookIndex % hooks.length];

  // Auto-rotate hooks every 4s until user interacts
  useEffect(() => {
    if (!autoRotate || hooks.length < 2) return;
    const t = setInterval(() => setHookIndex((i) => (i + 1) % hooks.length), HOOK_AUTOROTATE_MS);
    return () => clearInterval(t);
  }, [autoRotate, hooks.length]);

  const pickHook = (i: number) => {
    setAutoRotate(false);
    setHookIndex(((i % hooks.length) + hooks.length) % hooks.length);
  };

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
    <Card className="overflow-hidden p-3 md:p-5">
      <div className="grid gap-4 md:gap-5 lg:grid-cols-[260px_1fr]">
        {/* ---------- LEFT: phone ---------- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <PhoneFrame
            handle={handle}
            platform={idea.best_fit_platform}
            currentHook={currentHook}
            hookIndex={hookIndex}
            hookCount={hooks.length}
            onPrev={() => pickHook(hookIndex - 1)}
            onNext={() => pickHook(hookIndex + 1)}
            liked={liked}
            likeCount={idea.like_count ?? 0}
            canLike={!!me}
            onLike={() => toggleLike.mutate()}
            onComment={() => setShowComments(true)}
            onShare={() => setShowShare(true)}
            onSave={() => saveItem.mutate({
              kind: 'idea',
              source_run_id: runId ?? null,
              source_id: idea.id,
              payload: { ...idea },
            })}
            caption={idea.caption}
            hashtags={idea.hashtags}
          />
        </div>

        {/* ---------- RIGHT: full breakdown ---------- */}
        <div className="space-y-4 min-w-0">
          <header className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Idea #{idea.idea_number}
                {idea.best_fit_platform && <> · {idea.best_fit_platform}</>}
              </p>
              <h3 className="mt-1 font-display text-lg leading-tight">{idea.title}</h3>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit} title="AI edit">
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> AI edit
            </Button>
          </header>

          {/* HOOKS LIST */}
          <Section title={`Hooks (${hooks.length})`} hint="Tap a hook to preview it in the phone">
            <ol className="space-y-1.5">
              {hooks.map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickHook(i)}
                    className={`w-full text-left rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                      i === hookIndex
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <span className="mr-2 inline-block w-4 text-xs font-semibold text-muted-foreground">
                      {i + 1}.
                    </span>
                    {h}
                  </button>
                </li>
              ))}
            </ol>
          </Section>

          {idea.script && (
            <Section title="Script">
              <p className="text-sm whitespace-pre-line max-h-56 overflow-y-auto pr-1">
                {idea.script}
              </p>
            </Section>
          )}

          {idea.caption && (
            <Section title="Caption">
              <p className="text-sm whitespace-pre-line">{idea.caption}</p>
            </Section>
          )}

          {idea.cta && (
            <Section title="Call to action">
              <p className="text-sm">{idea.cta}</p>
            </Section>
          )}

          {idea.hashtags?.length > 0 && (
            <Section title="Hashtags">
              <div className="flex flex-wrap gap-1">
                {idea.hashtags.map((h) => (
                  <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                ))}
              </div>
            </Section>
          )}

          <WhyItWorks idea={idea} />
        </div>
      </div>

      <CommentsDialog open={showComments} onOpenChange={setShowComments} ideaId={idea.id} me={me} />
      <ShareDialog open={showShare} onOpenChange={setShowShare} ideaId={idea.id} />
    </Card>
  );
};

/* ---------------- Section helper ---------------- */

const Section = ({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) => (
  <section>
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h4>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
    {children}
  </section>
);

/* ---------------- Phone frame ---------------- */

interface PhoneFrameProps {
  handle: string;
  platform: string | null;
  currentHook: string;
  hookIndex: number;
  hookCount: number;
  onPrev: () => void;
  onNext: () => void;
  liked: boolean;
  likeCount: number;
  canLike: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  caption: string | null;
  hashtags: string[];
}

const PhoneFrame = ({
  handle, platform, currentHook, hookIndex, hookCount,
  onPrev, onNext, liked, likeCount, canLike, onLike, onComment, onShare, onSave,
  caption, hashtags,
}: PhoneFrameProps) => (
  <div className="relative mx-auto w-full max-w-[280px] rounded-[2rem] border-[10px] border-foreground/90 bg-background shadow-xl overflow-hidden">
    <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-foreground/90" />

    {/* IG header */}
    <div className="flex items-center gap-2 px-3 pt-6 pb-2 border-b border-border">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 p-[2px]">
        <div className="h-full w-full rounded-full bg-background" />
      </div>
      <span className="text-xs font-semibold truncate">{handle}</span>
      <Badge variant="outline" className="ml-auto text-[8px] capitalize">
        {platform ?? 'reel'}
      </Badge>
    </div>

    {/* Visual */}
    <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/20 via-muted to-accent/20 flex items-center justify-center p-4 text-center">
      <p key={hookIndex} className="font-display text-base leading-tight text-foreground drop-shadow-sm animate-fade-in">
        {currentHook}
      </p>

      {hookCount > 1 && (
        <>
          <button type="button" onClick={onPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 hover:bg-background"
            aria-label="Previous hook">
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button type="button" onClick={onNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 hover:bg-background"
            aria-label="Next hook">
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {Array.from({ length: hookCount }).map((_, i) => (
              <span key={i} className={`h-1 w-1 rounded-full ${i === hookIndex ? 'bg-foreground' : 'bg-foreground/30'}`} />
            ))}
          </div>
        </>
      )}

      <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider">
        Hook {hookIndex + 1}/{hookCount}
      </span>
    </div>

    {/* IG action bar */}
    <div className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={onLike} disabled={!canLike}
        className="transition-transform active:scale-90"
        aria-label={liked ? 'Unlike' : 'Like'}>
        <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
      </button>
      <button type="button" onClick={onComment} aria-label="Comment">
        <MessageCircle className="h-5 w-5" />
      </button>
      <button type="button" onClick={onShare} aria-label="Share">
        <Send className="h-5 w-5" />
      </button>
      <button type="button" onClick={onSave} className="ml-auto" aria-label="Save">
        <Bookmark className="h-5 w-5" />
      </button>
    </div>

    <div className="px-3 pb-3 space-y-1">
      <p className="text-xs font-semibold">{likeCount.toLocaleString()} likes</p>
      {caption && (
        <p className="text-[11px] line-clamp-2">
          <span className="font-semibold">{handle} </span>
          <span className="text-muted-foreground">{caption}</span>
        </p>
      )}
      {hashtags?.length > 0 && (
        <p className="text-[10px] text-primary line-clamp-1">
          {hashtags.slice(0, 6).map((h) => `#${h}`).join(' ')}
        </p>
      )}
    </div>
  </div>
);

/* ---------------- Why it works + inspiration ---------------- */

interface InspirationPost {
  id: string;
  author_handle: string;
  platform: string;
  post_url: string | null;
  thumbnail_url: string | null;
  views: number | null;
  likes: number | null;
  pattern_tag: string | null;
  hook_type: string | null;
}

const WhyItWorks = ({ idea }: { idea: MockupIdea }) => {
  const { data: inspiration } = useQuery<InspirationPost | null>({
    queryKey: ['idea-inspiration', idea.inspired_by_post_id],
    enabled: !!idea.inspired_by_post_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('id, author_handle, platform, post_url, thumbnail_url, views, likes, pattern_tag, hook_type')
        .eq('id', idea.inspired_by_post_id!)
        .maybeSingle();
      if (error) throw error;
      return data as InspirationPost | null;
    },
  });

  const patternTag = inspiration?.pattern_tag ?? inspiration?.hook_type ?? idea.inspiration_source ?? null;

  if (!idea.why_it_works && !inspiration && !patternTag) return null;

  return (
    <Section title="Why this works">
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        {patternTag && (
          <Badge variant="outline" className="text-[10px] capitalize">
            <Lightbulb className="mr-1 h-3 w-3" /> Pattern: {patternTag.replace(/_/g, ' ')}
          </Badge>
        )}
        {idea.why_it_works && (
          <p className="text-sm whitespace-pre-line">{idea.why_it_works}</p>
        )}
        {inspiration && (
          <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
            <IgThumb
              src={inspiration.thumbnail_url}
              alt={`Post by @${inspiration.author_handle}`}
              className="h-14 w-14 shrink-0 rounded"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Inspired by
              </p>
              <p className="truncate text-sm font-semibold">
                @{inspiration.author_handle}
                <span className="ml-1 text-xs font-normal text-muted-foreground">· {inspiration.platform}</span>
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {(inspiration.views ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{inspiration.views!.toLocaleString()}</span>
                )}
                {(inspiration.likes ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{inspiration.likes!.toLocaleString()}</span>
                )}
              </div>
            </div>
            {inspiration.post_url && (
              <a
                href={inspiration.post_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </Section>
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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
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

export default IdeaPhoneMockup;
