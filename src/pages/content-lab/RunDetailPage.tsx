import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Eye, Heart, MessageCircle, ArrowLeft, Wand2, ExternalLink, Bookmark, Anchor } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSaveItem, useSaveHook } from '@/hooks/useContentLabSaves';
import UsageHeader from '@/components/content-lab/UsageHeader';
import IdeaPhoneMockup from '@/components/content-lab/IdeaPhoneMockup';
import usePageMeta from '@/hooks/usePageMeta';

interface RunRow {
  id: string; status: string; current_phase: string | null;
  created_at: string; client_id: string;
  client_snapshot: { company_name?: string; industry?: string; location?: string } | null;
  error_message: string | null;
}
interface PostRow {
  id: string; bucket: string; platform: string; author_handle: string;
  caption: string | null; thumbnail_url: string | null; post_url: string | null;
  views: number; likes: number; comments: number; engagement_rate: number;
  posted_at: string | null; hook_type: string | null; hook_text: string | null;
  media_kind: 'video' | 'photo' | 'carousel' | null;
}
interface IdeaRow {
  id: string; idea_number: number; title: string; hook: string | null;
  hooks: string[] | null;
  script: string | null; caption: string | null; cta: string | null;
  hashtags: string[]; best_fit_platform: string | null;
  why_it_works: string | null; visual_direction: string | null;
  edit_count: number; like_count: number | null;
}

const PHASE_LABELS: Record<string, string> = {
  discover: 'Discovering competitors & viral accounts',
  validate: 'Validating handles',
  scrape: 'Scraping posts',
  analyse: 'Analysing patterns',
  ideate: 'Generating ideas',
  notify: 'Sending notification',
};

const RunDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingIdea, setEditingIdea] = useState<IdeaRow | null>(null);

  usePageMeta({ title: 'Content Lab Run', description: 'Research and ideas for this client run.' });

  const { data: run } = useQuery({
    queryKey: ['cl-run', id],
    enabled: !!id,
    refetchInterval: (query) => {
      const r = (query.state.data as RunRow | null);
      return r && (r.status === 'pending' || r.status === 'running') ? 4000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase.from('content_lab_runs').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as RunRow | null;
    },
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['cl-run-progress', id],
    enabled: !!id,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_run_progress')
        .select('id, phase, status, message, created_at')
        .eq('run_id', id!)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['cl-run-posts', id],
    enabled: !!id && run?.status === 'completed',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('id, bucket, platform, author_handle, caption, thumbnail_url, post_url, views, likes, comments, engagement_rate, posted_at, hook_type, hook_text, media_kind')
        .eq('run_id', id!)
        .order('engagement_rate', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PostRow[];
    },
  });

  const { data: ideas = [] } = useQuery({
    queryKey: ['cl-run-ideas', id],
    enabled: !!id && run?.status === 'completed',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select('id, idea_number, title, hook, hooks, script, caption, cta, hashtags, best_fit_platform, why_it_works, visual_direction, edit_count, like_count')
        .eq('run_id', id!)
        .order('idea_number');
      if (error) throw error;
      return (data ?? []) as unknown as IdeaRow[];
    },
  });

  const ownPosts = useMemo(() => posts.filter((p) => p.bucket === 'own'), [posts]);
  const competitorPosts = useMemo(() => posts.filter((p) => p.bucket === 'competitor'), [posts]);
  const viralPosts = useMemo(
    () => posts
      .filter((p) => p.bucket === 'viral')
      .slice()
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 15),
    [posts],
  );

  const competitorAccounts = useMemo(() => {
    const map = new Map<string, { handle: string; platform: string; postCount: number; avgViews: number; avgLikes: number }>();
    competitorPosts.forEach((p) => {
      const key = `${p.platform}:${p.author_handle}`;
      const cur = map.get(key) ?? { handle: p.author_handle, platform: p.platform, postCount: 0, avgViews: 0, avgLikes: 0 };
      cur.postCount += 1;
      cur.avgViews += p.views ?? 0;
      cur.avgLikes += p.likes ?? 0;
      map.set(key, cur);
    });
    return [...map.values()].map((a) => ({
      ...a,
      avgViews: Math.round(a.avgViews / Math.max(a.postCount, 1)),
      avgLikes: Math.round(a.avgLikes / Math.max(a.postCount, 1)),
    }));
  }, [competitorPosts]);

  if (!run) {
    return <AppLayout><p className="p-8 text-sm text-muted-foreground">Loading run…</p></AppLayout>;
  }

  const isProcessing = run.status === 'pending' || run.status === 'running';

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/content-lab')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Content Lab
          </Button>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Run</p>
            <h1 className="mt-1 font-display text-3xl">{run.client_snapshot?.company_name ?? 'Client'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[run.client_snapshot?.industry, run.client_snapshot?.location].filter(Boolean).join(' · ')}
              {' · '}{new Date(run.created_at).toLocaleString()}
            </p>
          </div>
          <UsageHeader buttonSize="sm" />
        </header>

        {isProcessing && (
          <Card className="space-y-3 border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="font-display text-base">Working on your report…</p>
            </div>
            <ol className="space-y-1.5 text-xs">
              {progress.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'failed' ? 'bg-destructive' : p.status === 'ok' ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
                  <span className="text-muted-foreground">{PHASE_LABELS[p.phase] ?? p.phase}</span>
                  {p.message && <span className="ml-2 text-muted-foreground">— {p.message}</span>}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {run.status === 'failed' && (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Run failed</p>
            <p className="text-muted-foreground">{run.error_message ?? 'Unknown error.'}</p>
          </Card>
        )}

        {run.status === 'completed' && (
          <Tabs defaultValue="ideas">
            <TabsList className="w-full overflow-x-auto">
              <TabsTrigger value="ideas">Ideas ({ideas.length})</TabsTrigger>
              <TabsTrigger value="own">Your content ({ownPosts.length})</TabsTrigger>
              <TabsTrigger value="competitors">Local competitors ({competitorAccounts.length})</TabsTrigger>
              <TabsTrigger value="viral">Viral ({viralPosts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="ideas" className="mt-4">
              {ideas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ideas in this run.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ideas.map((i) => <IdeaCard key={i.id} idea={i} onEdit={() => setEditingIdea(i)} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="own" className="mt-4">
              <PostGrid posts={ownPosts} emptyMsg="No own posts found in the last 30 days." />
            </TabsContent>

            <TabsContent value="competitors" className="mt-4 space-y-6">
              {competitorAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No local competitors found.</p>
              ) : (
                competitorAccounts.map((acc) => (
                  <div key={`${acc.platform}:${acc.handle}`} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base">@{acc.handle}</h3>
                      <Badge variant="outline" className="text-[10px] capitalize">{acc.platform}</Badge>
                      <span className="text-xs text-muted-foreground">{acc.postCount} posts</span>
                      <span className="text-xs text-muted-foreground">· avg {acc.avgViews.toLocaleString()} views</span>
                      <span className="text-xs text-muted-foreground">· avg {acc.avgLikes.toLocaleString()} likes</span>
                    </div>
                    <PostGrid posts={competitorPosts.filter((p) => p.author_handle === acc.handle && p.platform === acc.platform).slice(0, 6)} />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="viral" className="mt-4">
              <PostGrid posts={viralPosts} emptyMsg="No viral posts found yet — try running again or add more competitor handles." />
            </TabsContent>
          </Tabs>
        )}

        <EditIdeaDialog
          idea={editingIdea}
          onClose={() => setEditingIdea(null)}
          onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['cl-run-ideas', id] }); }}
        />
      </div>
    </AppLayout>
  );
};

const PostGrid = ({ posts, runId, emptyMsg }: { posts: PostRow[]; runId?: string; emptyMsg?: string }) => {
  const saveItem = useSaveItem();
  const saveHook = useSaveHook();
  if (posts.length === 0) return <p className="text-sm text-muted-foreground">{emptyMsg ?? 'No posts.'}</p>;
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {posts.map((p) => {
        const kind = p.media_kind ?? (p.platform === 'tiktok' ? 'video' : null);
        const isVideo = kind === 'video';
        return (
          <Card key={p.id} className="overflow-hidden">
            <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/40">
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt={p.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center">
                  <p className="line-clamp-4 text-[10px] text-muted-foreground">{p.caption ?? 'No preview available'}</p>
                </div>
              )}
              {kind && kind !== 'video' && (
                <Badge variant="secondary" className="absolute left-1 top-1 text-[9px] capitalize">{kind}</Badge>
              )}
            </div>
            <div className="space-y-1 p-2 text-[11px]">
              <p className="font-semibold truncate">@{p.author_handle}</p>
              {p.hook_type && <Badge variant="secondary" className="text-[9px]">{p.hook_type}</Badge>}
              {p.caption && <p className="text-muted-foreground line-clamp-2">{p.caption}</p>}
              <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                {isVideo && (
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {(p.views ?? 0).toLocaleString()}</span>
                )}
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {(p.likes ?? 0).toLocaleString()}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {(p.comments ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-1 pt-1">
                {p.post_url ? (
                  <a href={p.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <span />}
                <div className="flex items-center gap-0.5">
                  {p.hook_text && (
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      title="Save hook"
                      onClick={() => saveHook.mutate({
                        hook_text: p.hook_text!,
                        hook_type: p.hook_type,
                        platform: p.platform,
                        source_post_id: p.id,
                        example_caption: p.caption,
                        example_post_url: p.post_url,
                      })}
                    >
                      <Anchor className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    title="Save post"
                    onClick={() => saveItem.mutate({
                      kind: 'post',
                      source_run_id: runId ?? null,
                      source_id: p.id,
                      payload: { ...p },
                    })}
                  >
                    <Bookmark className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const IdeaCard = ({ idea, runId, onEdit }: { idea: IdeaRow; runId?: string; onEdit: () => void }) => {
  const saveItem = useSaveItem();
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Idea #{idea.idea_number}{idea.best_fit_platform && <> · <span className="capitalize">{idea.best_fit_platform}</span></>}
          </p>
          <h3 className="mt-1 font-display text-base leading-tight">{idea.title}</h3>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      </div>
      {idea.hook && <p className="text-sm font-medium">{idea.hook}</p>}
      {idea.script && <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">{idea.script}</p>}
      {idea.caption && <p className="text-[11px] text-muted-foreground line-clamp-2">{idea.caption}</p>}
      {idea.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {idea.hashtags.slice(0, 5).map((h) => <Badge key={h} variant="secondary" className="text-[9px]">#{h}</Badge>)}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Wand2 className="mr-2 h-3 w-3" /> AI edit
        </Button>
        <Button
          variant="outline" size="sm"
          title="Save to library"
          onClick={() => saveItem.mutate({
            kind: 'idea',
            source_run_id: runId ?? null,
            source_id: idea.id,
            payload: { ...idea },
          })}
        >
          <Bookmark className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
};

const EditIdeaDialog = ({ idea, onClose, onSaved }: { idea: IdeaRow | null; onClose: () => void; onSaved: () => void }) => {
  const [instruction, setInstruction] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      if (!idea) throw new Error('No idea');
      const { data, error } = await supabase.functions.invoke('content-lab-regenerate-idea', {
        body: { idea_id: idea.id, instruction },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Idea updated');
      setInstruction('');
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not update idea'),
  });
  return (
    <Dialog open={!!idea} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refine this idea with AI</DialogTitle>
          <DialogDescription>
            Free edits, rate-limited to prevent abuse. Tell us what to change.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Make the hook more punchy, swap the CTA to focus on bookings, shorten the script"
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!instruction.trim() || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Refine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RunDetailPage;
