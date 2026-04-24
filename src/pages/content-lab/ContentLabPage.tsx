import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Search, Loader2, Play, FileText, Clock, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useContentLabRuns, useContentLabUsage, useClientsForPicker, type ContentLabRun, type ClientForPicker } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useStartContentLabRun } from '@/hooks/useStartContentLabRun';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import BuyCreditsDialog from '@/components/content-lab/BuyCreditsDialog';
import StartRunDialog from '@/components/content-lab/StartRunDialog';
import usePageMeta from '@/hooks/usePageMeta';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-500',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const ContentLabPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasAccess, canGenerate, isLoading: accessLoading } = useContentLabAccess();
  const { data: clients = [], isLoading: clientsLoading } = useClientsForPicker();
  const { data: runs = [], isLoading: runsLoading } = useContentLabRuns();
  const { data: usage } = useContentLabUsage();
  const { start, starting } = useStartContentLabRun();

  const [search, setSearch] = useState('');
  const [pendingClient, setPendingClient] = useState<ClientForPicker | null>(null);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);

  usePageMeta({ title: 'Content Lab', description: 'Pick a client. Generate research-backed content ideas in minutes.' });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const credits = params.get('credits');
    if (!credits) return;
    if (credits === 'success') {
      toast.success('Payment received — credits will appear shortly.');
      void queryClient.invalidateQueries({ queryKey: ['content-lab-usage'] });
    } else if (credits === 'cancelled') toast.info('Checkout cancelled');
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || c.company_name.toLowerCase().includes(q));
  }, [clients, search]);

  const runsByClient = useMemo(() => {
    const map = new Map<string, ContentLabRun[]>();
    runs.forEach((r) => { map.set(r.client_id, [...(map.get(r.client_id) ?? []), r]); });
    return map;
  }, [runs]);

  const noCredits = (usage?.creditBalance ?? 0) <= 0;

  const startRun = async (clientId: string) => {
    await start(clientId);
    setPendingClient(null);
  };

  if (accessLoading) {
    return <AppLayout><p className="p-8 text-sm text-muted-foreground">Loading…</p></AppLayout>;
  }
  if (!hasAccess) return <AppLayout><ContentLabPaywall /></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-8 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab"
          icon={Sparkles}
          title="Pick a client. Generate ideas."
          subtitle="Research-backed content ideas based on your client's own posts, local competitors, and viral worldwide content."
          actions={
            <>
              {usage && (
                <Badge variant={noCredits ? 'destructive' : 'outline'} className="text-xs">
                  {usage.creditBalance.toLocaleString()} credits
                </Badge>
              )}
              <Button variant="outline" size="lg" onClick={() => setCreditsDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Buy credits
              </Button>
            </>
          }
        />

        <BuyCreditsDialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen} />

        <AlertDialog open={!!pendingClient} onOpenChange={(o) => !o && setPendingClient(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Generate ideas for {pendingClient?.company_name}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>This uses <strong>1 credit</strong> and takes about 3-6 minutes. We'll scrape your client's last 30 days, find local competitors, pull viral worldwide content, then generate 30 ideas.</p>
                  {(!pendingClient?.industry || !pendingClient?.location) && (
                    <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                      Tip: add an industry and location to the client for sharper local-competitor research.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={starting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); if (pendingClient) void startRun(pendingClient.id); }}
                disabled={starting}
              >
                {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl">Your clients</h2>
            <div className="relative ml-auto max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" className="pl-8" />
            </div>
          </div>

          {clientsLoading ? (
            <p className="text-sm text-muted-foreground">Loading clients…</p>
          ) : filteredClients.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No clients match.</Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredClients.map((c) => {
                const clientRuns = runsByClient.get(c.id) ?? [];
                const latest = clientRuns[0];
                return (
                  <Card key={c.id} className="flex flex-col gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="font-display text-base truncate">{c.company_name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.industry, c.location].filter(Boolean).join(' · ') || 'No industry / location set'}
                      </p>
                    </div>
                    {latest ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/content-lab/run/${latest.id}`)}
                        className="flex items-center justify-between rounded-md border border-border p-2 text-left text-xs transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          Last run · {new Date(latest.created_at).toLocaleDateString()}
                        </span>
                        <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_TONE[latest.status] ?? ''}`}>
                          <StatusIcon status={latest.status} /> {latest.status}
                        </span>
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">No runs yet.</p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setPendingClient(c)}
                      disabled={!canGenerate || noCredits}
                      className="mt-auto"
                    >
                      <Play className="mr-2 h-3.5 w-3.5" /> Generate ideas
                    </Button>
                    {clientRuns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => navigate(`/content-lab/run/${latest.id}`)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {clientRuns.length} previous runs →
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Recent runs</h2>
          {runsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 10).map((r) => {
                const client = clients.find((c) => c.id === r.client_id);
                return (
                  <Card
                    key={r.id}
                    className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:border-primary/40"
                    onClick={() => navigate(`/content-lab/run/${r.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{client?.company_name ?? 'Unknown client'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                        {r.current_phase && ` · ${r.current_phase}`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs capitalize ${STATUS_TONE[r.status] ?? ''}`}>
                      <StatusIcon status={r.status} /> {r.status}
                    </span>
                    {r.status === 'completed' && (
                      <Button variant="ghost" size="sm" className="ml-2" onClick={(e) => { e.stopPropagation(); navigate(`/content-lab/run/${r.id}`); }}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
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

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'running' || status === 'pending') return <Loader2 className="h-3 w-3 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="h-3 w-3" />;
  if (status === 'failed') return <AlertCircle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
};

export default ContentLabPage;
