import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Sparkles, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Play, CreditCard, Mail, X, Search, Lightbulb, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { useContentLabNiches, useContentLabUsage, useGroupedRuns, ContentLabRun, ContentLabNiche } from '@/hooks/useContentLab';
import { useBenchmarkPoolStatus } from '@/hooks/useBenchmarkPoolStatus';
import BenchmarkQualityBadge from '@/components/content-lab/BenchmarkQualityBadge';
import BuyCreditsDialog from '@/components/content-lab/BuyCreditsDialog';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: niches = [], isLoading: nichesLoading } = useContentLabNiches();
  const { data: groupedRuns = [], isLoading: runsLoading } = useGroupedRuns();
  const { data: usage } = useContentLabUsage();
  const [runningNiche, setRunningNiche] = useState<string | null>(null);
  const [pendingNicheId, setPendingNicheId] = useState<string | null>(null);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(() => localStorage.getItem('cl-guide-dismissed') === '1');

  usePageMeta({ title: 'Content Lab', description: 'Discover what is working in your niche and generate ready-to-film content ideas.' });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const credits = params.get('credits');
    if (!credits) return;
    if (credits === 'success') {
      toast.success('Payment received — credits will appear in a moment');
      void queryClient.invalidateQueries({ queryKey: ['content-lab-usage'] });
    } else if (credits === 'cancelled') {
      toast.info('Checkout cancelled');
    }
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const allRuns = groupedRuns.flatMap((g) => g.runs);
  const latestRun = allRuns[0];
  const monthlyExhausted = usage ? usage.runsThisMonth >= usage.runsLimit : false;
  const noCredits = (usage?.creditBalance ?? 0) <= 0;
  const blocked = monthlyExhausted && noCredits;

  const dismissGuide = () => {
    localStorage.setItem('cl-guide-dismissed', '1');
    setGuideDismissed(true);
  };

  const startRun = async (nicheId: string) => {
    setRunningNiche(nicheId);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-pipeline', {
        body: { niche_id: nicheId, email_on_complete: true },
      });
      if (error) throw error;
      toast.success("Run started — we'll email you when your ideas are ready (~20–40 min).");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['content-lab-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['content-lab-usage'] }),
      ]);
      if (data?.run_id) navigate(`/content-lab/run/${data.run_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start run');
    } finally {
      setRunningNiche(null);
    }
  };

  const handleRunNow = (nicheId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (blocked) {
      toast.error(`Monthly limit reached (${usage?.runsThisMonth}/${usage?.runsLimit}) and no credits left. Top up to keep running.`);
      return;
    }
    setPendingNicheId(nicheId);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-8 p-6 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab"
          icon={Sparkles}
          title="Discover. Decode. Create."
          subtitle="Pull the highest-performing posts from your niche, decode why they work, and turn them into 12 ready-to-film content ideas every month."
          actions={
            <>
              {usage && (
                <Badge
                  variant={blocked ? 'destructive' : monthlyExhausted ? 'secondary' : 'outline'}
                  className="font-body text-xs"
                >
                  {usage.runsThisMonth} / {usage.runsLimit} runs · {usage.creditBalance} credits
                </Badge>
              )}
              <Button variant="outline" size="lg" onClick={() => setCreditsDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Buy credits
              </Button>
              <Button size="lg" onClick={() => navigate('/content-lab/niche/new')}>
                <Plus className="mr-2 h-4 w-4" /> New Niche
              </Button>
            </>
          }
        />

        {!guideDismissed && (
          <Card className="relative border-primary/20 bg-primary/5 p-5">
            <button
              type="button"
              onClick={dismissGuide}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Dismiss guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <h3 className="font-display text-base">How Content Lab works</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Search, title: '1. Discover', body: 'We scrape your niche, top benchmarks and competitors.' },
                { icon: Lightbulb, title: '2. Decode', body: 'AI analyses what is working and why — hooks, formats, trends.' },
                { icon: Wand2, title: '3. Create', body: '12 ready-to-film ideas tailored to your brand voice.' },
              ].map((s) => (
                <div key={s.title} className="flex items-start gap-2 text-xs">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{s.title}</p>
                    <p className="text-muted-foreground">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <BuyCreditsDialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen} />

        <AlertDialog open={!!pendingNicheId} onOpenChange={(open) => !open && setPendingNicheId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start your Content Lab run?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    This typically takes <strong>20–40 minutes</strong> end to end. We'll scrape your latest posts, the top benchmark accounts and competitors,
                    decode what's working, then generate 12 ready-to-film ideas.
                  </p>
                  <p className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-foreground">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>You'll get an email the moment your ideas are ready — feel free to close this tab.</span>
                  </p>
                  {usage && (
                    <p className="text-xs text-muted-foreground">
                      Uses 1 of {usage.runsLimit} monthly runs ({usage.runsThisMonth} used so far).
                      {monthlyExhausted && ` Will spend 1 credit instead — ${usage.creditBalance} available.`}
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const id = pendingNicheId;
                  setPendingNicheId(null);
                  if (id) void startRun(id);
                }}
              >
                Start run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                <NicheCard
                  key={niche.id}
                  niche={niche}
                  isRunning={runningNiche === niche.id}
                  onOpen={() => navigate(`/content-lab/niche/${niche.id}`)}
                  onRun={(e) => handleRunNow(niche.id, e)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl">Recent Runs</h2>
          {runsLoading ? (
            <p className="text-sm text-muted-foreground">Loading runs…</p>
          ) : groupedRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Create a niche to generate your first report.</p>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={groupedRuns.slice(0, 1).map((g) => g.clientId)}
              className="space-y-2"
            >
              {groupedRuns.map((group) => (
                <AccordionItem key={group.clientId} value={group.clientId} className="rounded-lg border bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                      <span className="font-display text-sm">{group.clientName}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.runs.length} run{group.runs.length === 1 ? '' : 's'} · last {new Date(group.latestAt).toLocaleDateString()}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div className="space-y-2 pb-2">
                      {group.runs.slice(0, 5).map((run) => {
                        const niche = niches.find((n) => n.id === run.niche_id);
                        const summary = (run.summary ?? {}) as { display_name?: string; description?: string };
                        const created = new Date(run.created_at);
                        const monthLabel = created.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                        const title = summary.display_name ?? `${group.clientName} · ${monthLabel}`;
                        const subtitle = summary.description ?? `${niche?.label ?? 'Untitled niche'} · ${created.toLocaleDateString()}`;
                        return (
                          <Card
                            key={run.id}
                            className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:border-primary/40"
                            onClick={() => run.status === 'completed' && navigate(`/content-lab/run/${run.id}`)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-body text-sm font-medium">{title}</p>
                              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                            </div>
                            <RunStatusBadge status={run.status} />
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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

interface NicheCardProps {
  niche: ContentLabNiche;
  isRunning: boolean;
  onOpen: () => void;
  onRun: (e: React.MouseEvent) => void;
}

const NicheCard = ({ niche, isRunning, onOpen, onRun }: NicheCardProps) => {
  const { data: pool } = useBenchmarkPoolStatus(niche.niche_tag, niche.platforms_to_scrape, { poll: true });
  const hasHandles =
    niche.tracked_handles.length > 0 ||
    niche.tracked_hashtags.length > 0 ||
    niche.competitor_urls.length > 0;
  const noHandles = !hasHandles;
  const buildingMessage = pool && !pool.canRun
    ? `Benchmarks still building. This run will use saved niche benchmarks.`
    : null;

  const runButton = (
    <Button
      size="sm"
      className="mt-4 w-full"
      onClick={onRun}
      disabled={isRunning || noHandles}
    >
      {isRunning ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Play className="mr-2 h-3.5 w-3.5" />
      )}
      Run report now
    </Button>
  );

  return (
    <Card
      className="cursor-pointer p-5 transition-colors hover:border-primary/40"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg">{niche.label}</h3>
        {pool && (
          <BenchmarkQualityBadge quality={pool.quality} verifiedCount={pool.verifiedCount} />
        )}
      </div>
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
      {noHandles ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block" onClick={(e) => e.stopPropagation()}>
              {runButton}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px] text-xs">
            Add handles, hashtags, or competitors to this niche before running.
          </TooltipContent>
        </Tooltip>
      ) : (
        runButton
      )}
      {buildingMessage && (
        <p className="mt-2 text-[11px] text-muted-foreground">{buildingMessage}</p>
      )}
    </Card>
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
