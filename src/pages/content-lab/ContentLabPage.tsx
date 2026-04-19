import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useContentLabNiches, useContentLabRuns, useContentLabUsage, ContentLabRun } from '@/hooks/useContentLab';
import usePageMeta from '@/hooks/usePageMeta';

const STATUS_CONFIG: Record<ContentLabRun['status'], { label: string; icon: typeof Clock; tone: string }> = {
  pending: { label: 'Pending', icon: Clock, tone: 'bg-muted text-muted-foreground' },
  scraping: { label: 'Scraping', icon: Loader2, tone: 'bg-primary/10 text-primary' },
  analysing: { label: 'Analysing', icon: Loader2, tone: 'bg-primary/10 text-primary' },
  ideating: { label: 'Ideating', icon: Loader2, tone: 'bg-primary/10 text-primary' },
  completed: { label: 'Completed', icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-500' },
  failed: { label: 'Failed', icon: AlertCircle, tone: 'bg-destructive/10 text-destructive' },
};

const ContentLabPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: niches = [], isLoading: nichesLoading } = useContentLabNiches();
  const { data: runs = [], isLoading: runsLoading } = useContentLabRuns();
  const [runningNiche, setRunningNiche] = useState<string | null>(null);

  usePageMeta({ title: 'Content Lab', description: 'Discover what is working in your niche and generate ready-to-film content ideas.' });

  const latestRun = runs[0];

  const handleRunNow = async (nicheId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRunningNiche(nicheId);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-pipeline', {
        body: { niche_id: nicheId },
      });
      if (error) throw error;
      toast.success('Run started — refresh in ~1 min for results');
      await queryClient.invalidateQueries({ queryKey: ['content-lab-runs'] });
      if (data?.run_id) navigate(`/content-lab/run/${data.run_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start run');
    } finally {
      setRunningNiche(null);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-8 p-6 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Content Lab
            </div>
            <h1 className="mt-2 font-display text-4xl">Discover. Decode. Create.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Pull the highest-performing posts from your niche, decode why they work, and turn them into 12 ready-to-film content ideas every month.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate('/content-lab/niche/new')} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" /> New Niche
          </Button>
        </header>

        {latestRun && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Latest Run</p>
                <h2 className="mt-2 font-display text-2xl">
                  {niches.find((n) => n.id === latestRun.niche_id)?.label ?? 'Untitled niche'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(latestRun.created_at).toLocaleString()}
                </p>
              </div>
              <RunStatusBadge status={latestRun.status} />
            </div>
            {latestRun.status === 'completed' && (
              <Button className="mt-4" onClick={() => navigate(`/content-lab/run/${latestRun.id}`)}>
                <FileText className="mr-2 h-4 w-4" /> View Report
              </Button>
            )}
          </Card>
        )}

        <section>
          <h2 className="mb-4 font-display text-xl">Your Niches</h2>
          {nichesLoading ? (
            <p className="text-sm text-muted-foreground">Loading niches…</p>
          ) : niches.length === 0 ? (
            <EmptyNiches onCreate={() => navigate('/content-lab/niche/new')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {niches.map((niche) => (
                <Card
                  key={niche.id}
                  className="cursor-pointer p-5 transition-colors hover:border-primary/40"
                  onClick={() => navigate(`/content-lab/niche/${niche.id}`)}
                >
                  <h3 className="font-display text-lg">{niche.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {niche.tracked_handles.length} handles · {niche.tracked_hashtags.length} hashtags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {niche.tracked_hashtags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={(e) => handleRunNow(niche.id, e)}
                    disabled={runningNiche === niche.id}
                  >
                    {runningNiche === niche.id ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-3.5 w-3.5" />
                    )}
                    Run report now
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl">Recent Runs</h2>
          {runsLoading ? (
            <p className="text-sm text-muted-foreground">Loading runs…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Create a niche to generate your first report.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const niche = niches.find((n) => n.id === run.niche_id);
                return (
                  <Card
                    key={run.id}
                    className="flex items-center justify-between p-4 transition-colors hover:border-primary/40 cursor-pointer"
                    onClick={() => run.status === 'completed' && navigate(`/content-lab/run/${run.id}`)}
                  >
                    <div>
                      <p className="font-body text-sm font-medium">{niche?.label ?? 'Unknown niche'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </div>
                    <RunStatusBadge status={run.status} />
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

const RunStatusBadge = ({ status }: { status: ContentLabRun['status'] }) => {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const spinning = ['scraping', 'analysing', 'ideating'].includes(status);
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.tone}`}>
      <Icon className={`h-3 w-3 ${spinning ? 'animate-spin' : ''}`} />
      {cfg.label}
    </div>
  );
};

const EmptyNiches = ({ onCreate }: { onCreate: () => void }) => (
  <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center">
    <Sparkles className="h-8 w-8 text-muted-foreground" />
    <h3 className="font-display text-lg">No niches yet</h3>
    <p className="max-w-md text-sm text-muted-foreground">
      A niche tells Content Lab who to track. Add competitor handles, hashtags, and keywords to start pulling viral inspiration.
    </p>
    <Button onClick={onCreate}>
      <Plus className="mr-2 h-4 w-4" /> Create your first niche
    </Button>
  </Card>
);

export default ContentLabPage;
