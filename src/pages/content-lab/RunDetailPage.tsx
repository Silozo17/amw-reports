
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

  const { data: posts = [] } = useQuery({
    queryKey: ['content-lab-posts', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('*')
        .eq('run_id', id!)
        .order('engagement_rate', { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

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

        <Tabs defaultValue="feed" className="space-y-6">
          <TabsList>
            <TabsTrigger value="feed">Viral Feed ({posts.length})</TabsTrigger>
            <TabsTrigger value="ideas">12 Ideas ({ideas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-3">
            {posts.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">No posts yet for this run.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((p) => (
                  <ViralPostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ideas" className="space-y-4">
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
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default RunDetailPage;
