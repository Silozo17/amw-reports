import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import usePageMeta from '@/hooks/usePageMeta';

const RunDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (!run?.pdf_storage_path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('content-lab-reports')
        .createSignedUrl(run.pdf_storage_path, 60);
      if (error || !data) throw error ?? new Error('No URL');
      window.open(data.signedUrl, '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate download link');
    } finally {
      setDownloading(false);
    }
  };

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
          </div>
          {run?.pdf_storage_path ? (
            <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          ) : run?.status === 'rendering' ? (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> PDF generating…
            </Button>
          ) : null}
        </header>

        <Tabs defaultValue="feed" className="space-y-6">
          <TabsList>
            <TabsTrigger value="feed">Viral Feed ({posts.length})</TabsTrigger>
            <TabsTrigger value="ideas">12 Ideas ({ideas.length})</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-3">
            {posts.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">No posts yet for this run.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((p) => (
                  <Card key={p.id} className="overflow-hidden">
                    {p.thumbnail_url && (
                      <div className="aspect-[4/5] bg-muted">
                        <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">@{p.author_handle}</span>
                        <Badge variant="secondary" className="text-[10px]">{p.platform}</Badge>
                      </div>
                      <p className="line-clamp-3 text-sm">{p.caption ?? '—'}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{p.likes.toLocaleString()} likes</span>
                        <span>{p.comments.toLocaleString()} comments</span>
                      </div>
                      {p.hook_text && (
                        <div className="rounded-md bg-primary/5 p-2 text-xs">
                          <span className="font-semibold text-primary">Hook: </span>
                          {p.hook_text}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ideas" className="space-y-4">
            {ideas.length === 0 ? (
              <Card className="p-10 text-center text-sm text-muted-foreground">Ideas will appear here once the run completes.</Card>
            ) : (
              ideas.map((idea) => (
                <Card key={idea.id} className="space-y-3 p-6">
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
