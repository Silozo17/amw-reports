
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import usePageMeta from '@/hooks/usePageMeta';
import IdeaPreviewInstagram from '@/components/content-lab/IdeaPreviewInstagram';
import IdeaPreviewTikTok from '@/components/content-lab/IdeaPreviewTikTok';
import IdeaPreviewFacebook from '@/components/content-lab/IdeaPreviewFacebook';
import ViralPostCard from '@/components/content-lab/ViralPostCard';
import IdeaPipelineBoard from '@/components/content-lab/IdeaPipelineBoard';
import HookLibrary from '@/components/content-lab/HookLibrary';
import BenchmarkQualityBadge from '@/components/content-lab/BenchmarkQualityBadge';
import IdeaActionButtons from '@/components/content-lab/IdeaActionButtons';
import IdeaPerformanceStrip from '@/components/content-lab/IdeaPerformanceStrip';
import { useBenchmarkPoolStatus } from '@/hooks/useBenchmarkPoolStatus';

const renderPreview = (platform: string | null, hook: string, caption: string | null) => {
  const p = (platform ?? 'instagram').toLowerCase();
  if (p === 'tiktok') return <IdeaPreviewTikTok hook={hook} caption={caption} />;
  if (p === 'facebook') return <IdeaPreviewFacebook hook={hook} caption={caption} />;
  return <IdeaPreviewInstagram hook={hook} caption={caption} />;
};

const RunDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [rescraping, setRescraping] = useState(false);

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-resume', {
        body: { run_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Retry started — reusing existing scrape data, no new credits used.');
      queryClient.invalidateQueries({ queryKey: ['content-lab-run', id] });
      queryClient.invalidateQueries({ queryKey: ['content-lab-ideas', id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const handleRescrape = async () => {
    if (!id) return;
    setRescraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-resume', {
        body: { run_id: id, rescrape: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Rescrape started — refreshing posts with transcripts, music & hashtags.');
      queryClient.invalidateQueries({ queryKey: ['content-lab-run', id] });
      queryClient.invalidateQueries({ queryKey: ['content-lab-posts', id] });
      queryClient.invalidateQueries({ queryKey: ['content-lab-ideas', id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rescrape failed');
    } finally {
      setRescraping(false);
    }
  };

  usePageMeta({ title: 'Content Lab Report', description: 'Viral feed and 12 ideas for the month.' });

  const { data: run } = useQuery({
    queryKey: ['content-lab-run', id],
    enabled: !!id,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status && ['completed', 'failed'].includes(status) ? false : 4000;
    },
    queryFn: async () => {
      const { data, error } = await supabase.from('content_lab_runs').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: niche } = useQuery({
    queryKey: ['content-lab-niche-for-run', run?.niche_id],
    enabled: !!run?.niche_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_niches')
        .select('niche_tag, platforms_to_scrape, label')
        .eq('id', run!.niche_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: pool } = useBenchmarkPoolStatus(niche?.niche_tag, niche?.platforms_to_scrape);

  const { data: posts = [] } = useQuery({
    queryKey: ['content-lab-posts', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('*')
        .eq('run_id', id!)
        .order('views', { ascending: false })
        .order('likes', { ascending: false })
        .order('comments', { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Bucket fallback: legacy rows have bucket=null. Treat any non-'own' as benchmark
  // so the dashboard isn't empty for older scrapes.
  const bucketOf = (p: { bucket?: string | null; source?: string }): 'own' | 'benchmark' => {
    if (p.bucket === 'own') return 'own';
    if (p.bucket === 'benchmark' || p.bucket === 'competitor') return 'benchmark';
    return 'benchmark';
  };
  const ownPosts = posts.filter((p) => bucketOf(p as { bucket?: string | null; source?: string }) === 'own');
  const viralPosts = posts.filter((p) => bucketOf(p as { bucket?: string | null; source?: string }) === 'benchmark');
  const ownAvgViews = ownPosts.length > 0
    ? Math.round(ownPosts.reduce((s, p) => s + (p.views ?? 0), 0) / ownPosts.length)
    : 0;
  const benchmarkViewsSorted = viralPosts.map((p) => p.views ?? 0).sort((a, b) => a - b);
  const benchmarkP50 = benchmarkViewsSorted.length > 0
    ? benchmarkViewsSorted[Math.floor(benchmarkViewsSorted.length / 2)]
    : 0;
  const ownIsCompetitive = ownAvgViews > 0 && ownAvgViews >= benchmarkP50;
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);
  const topOwnHook = ownPosts.length > 0
    ? [...ownPosts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]?.hook_text ?? null
    : null;

  const { data: ideas = [] } = useQuery({
    queryKey: ['content-lab-ideas', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select('*')
        .eq('run_id', id!)
        .order('idea_number');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: analysedHooks = [] } = useQuery({
    queryKey: ['content-lab-hooks', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_hooks')
        .select('hook_text, mechanism, why_it_works, source_post_id')
        .eq('run_id', id!);
      if (error) throw error;
      const postMap = new Map(posts.map((p) => [p.id, p]));
      return (data ?? []).map((h) => {
        const sp = h.source_post_id ? postMap.get(h.source_post_id) : null;
        return {
          hook_text: h.hook_text,
          mechanism: h.mechanism,
          why_it_works: h.why_it_works,
          source_handle: sp?.author_handle ?? null,
          source_url: sp?.post_url ?? null,
        };
      });
    },
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/content-lab')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Content Lab Report</p>
            <h1 className="mt-2 font-display text-3xl">
              {run ? new Date(run.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '…'}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {niche?.label && <span className="text-sm text-muted-foreground">{niche.label}</span>}
              {pool && <BenchmarkQualityBadge quality={pool.quality} verifiedCount={pool.verifiedCount} />}
            </div>
            {run?.status === 'failed' && run?.error_message && (
              <p className="mt-2 max-w-2xl text-sm text-destructive">{run.error_message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {run?.status === 'failed' && posts.length > 0 && (
              <Button onClick={handleRetry} disabled={retrying} size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying…' : 'Retry ideation'}
              </Button>
            )}
            {posts.length > 0 && ['completed', 'failed'].includes(run?.status ?? '') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={rescraping}>
                    <Sparkles className={`mr-2 h-4 w-4 ${rescraping ? 'animate-spin' : ''}`} />
                    {rescraping ? 'Rescraping…' : 'Rescrape (uses credits)'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rescrape this run?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the existing posts and pull fresh data from Instagram via Apify, including
                      transcripts, hashtags, music and tagged users. <strong>This costs Apify credits</strong> (one
                      full scrape, ~73 posts). Ideas will also be regenerated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRescrape}>Rescrape now</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </header>

        <Tabs defaultValue="own" className="space-y-6">
          <TabsList>
            <TabsTrigger value="own">Your Latest Content ({ownPosts.length})</TabsTrigger>
            <TabsTrigger value="feed">Viral Feed ({viralPosts.length})</TabsTrigger>
            <TabsTrigger value="ideas">Ideas ({ideas.length})</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="hooks">Hook Library</TabsTrigger>
          </TabsList>

          <TabsContent value="own" className="space-y-4">
            {ownPosts.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                No own posts scraped yet for this run. Add your handle in the niche to see how your content stacks up.
              </Card>
            ) : (
              <>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Your avg views:</span>{' '}
                    <span className="font-semibold">{fmt(ownAvgViews)}</span>
                    <span className="mx-2 text-muted-foreground">vs benchmark median</span>{' '}
                    <span className="font-semibold">{fmt(benchmarkP50)}</span>
                    {topOwnHook && (
                      <span className="ml-3 block text-xs text-muted-foreground md:inline">
                        Top hook: <span className="italic">"{topOwnHook.slice(0, 80)}{topOwnHook.length > 80 ? '…' : ''}"</span>
                      </span>
                    )}
                  </div>
                  <Badge variant={ownIsCompetitive ? 'default' : 'outline'}>
                    {ownIsCompetitive ? 'On par with benchmarks' : 'Below benchmarks — ideas reverse-engineer top accounts only'}
                  </Badge>
                </Card>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...ownPosts]
                    .sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''))
                    .map((p) => (
                      <ViralPostCard key={p.id} post={p} />
                    ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="feed" className="space-y-3">
            {viralPosts.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">No viral posts yet for this run.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {viralPosts.map((p) => (
                  <ViralPostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ideas" className="space-y-4">
            {ideas.length > 0 && ownPosts.length > 0 && (
              <Card className="border-primary/30 bg-primary/5 p-3 text-sm">
                {ownIsCompetitive
                  ? 'Your views are on par with the top-10 benchmarks, so your top-performing posts are also being used as inspiration.'
                  : 'Your views are below the top-10 benchmark median, so ideas are reverse-engineered from top accounts only — your weak posts are used as anti-examples.'}
              </Card>
            )}
            {ideas.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">Ideas will appear here once the run completes.</Card>
            ) : (
              ideas.map((idea) => (
                <Card key={idea.id} className="grid gap-6 p-6 md:grid-cols-[260px_1fr]">
                  <div>
                    {renderPreview(idea.target_platform, idea.hook ?? idea.title, idea.caption)}
                    {idea.target_platform && (
                      <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                        {idea.target_platform}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Idea {idea.idea_number}</p>
                        <h3 className="mt-1 font-display text-xl">{idea.title}</h3>
                      </div>
                      {idea.duration_seconds && (
                        <Badge variant="outline">{idea.duration_seconds}s</Badge>
                      )}
                    </div>
                    {idea.hook && <p className="text-sm"><span className="font-semibold">Hook: </span>{idea.hook}</p>}
                    {Array.isArray(idea.hook_variants) && idea.hook_variants.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Hook variants</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {(idea.hook_variants as Array<{ text: string; mechanism: string; why: string }>).map((v, vi) => (
                            <div key={vi} className="rounded-md border border-border/50 bg-muted/30 p-2 text-xs">
                              <p className="font-medium leading-snug">{v.text}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{v.mechanism}</p>
                              {v.why && <p className="mt-1 text-muted-foreground">{v.why}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {idea.body && <p className="text-sm text-muted-foreground">{idea.body}</p>}
                    {idea.cta && <p className="text-sm"><span className="font-semibold">CTA: </span>{idea.cta}</p>}
                    {idea.why_it_works && (
                      <div className="rounded-md bg-primary/5 p-3 text-sm">
                        <span className="font-semibold text-primary">Why it works: </span>
                        {idea.why_it_works}
                      </div>
                    )}
                    {idea.hashtags && idea.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {idea.hashtags.map((h: string) => (
                          <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-3">
                      <IdeaActionButtons ideaId={idea.id} runId={id!} regenCount={(idea as { regen_count?: number }).regen_count ?? 0} />
                    </div>
                    <IdeaPerformanceStrip
                      ideaId={idea.id}
                      runId={id!}
                      status={idea.status ?? 'not_started'}
                      linkedPostId={(idea as { linked_post_id?: string | null }).linked_post_id ?? null}
                      actualViews={(idea as { actual_views?: number | null }).actual_views ?? null}
                      actualEngagementRate={(idea as { actual_engagement_rate?: number | null }).actual_engagement_rate ?? null}
                    />
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            {ideas.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                The pipeline will appear once ideas have been generated.
              </Card>
            ) : (
              <IdeaPipelineBoard
                runId={id!}
                ideas={ideas.map((i) => ({
                  id: i.id,
                  idea_number: i.idea_number,
                  title: i.title,
                  hook: i.hook ?? null,
                  target_platform: i.target_platform ?? null,
                  rating: i.rating ?? null,
                  status: i.status ?? 'not_started',
                }))}
                onSelect={() => { /* click-to-detail can be wired later; drag is the primary action */ }}
              />
            )}
          </TabsContent>

          <TabsContent value="hooks" className="space-y-4">
            <HookLibrary
              analysedHooks={analysedHooks}
              ideas={ideas.map((i) => ({
                idea_number: i.idea_number,
                hook: i.hook ?? null,
                hook_variants: (i.hook_variants as Array<{ text: string; mechanism: string; why: string }> | null) ?? null,
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default RunDetailPage;
