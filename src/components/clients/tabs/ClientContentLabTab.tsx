import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Sparkles, Loader2, ArrowRight, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentLabNiches, useContentLabRuns, useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import IdeaCard from '@/components/content-lab/IdeaCard';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { supabase } from '@/integrations/supabase/client';

interface ClientContentLabTabProps {
  clientId: string;
}

interface IdeaSummary {
  id: string;
  run_id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  caption: string | null;
  target_platform: string | null;
  rating: number | null;
  status: string;
  is_wildcard: boolean;
  duration_seconds: number | null;
}

/**
 * Per-client Content Lab view.
 *
 * Stripped of niche/run lists (those live globally on /content-lab now). Shows
 * the client's latest run summary and the top 6 ideas as premium cards. Anyone
 * needing the full picker can use /content-lab filtered by this client.
 */
const ClientContentLabTab = ({ clientId }: ClientContentLabTabProps) => {
  const navigate = useNavigate();
  const { hasAccess, canGenerate, isLoading: accessLoading } = useContentLabAccess();
  const { data: niches = [] } = useContentLabNiches(clientId);
  const { data: runs = [] } = useContentLabRuns(clientId);
  const { data: allIdeas = [] } = useAllIdeas(clientId);

  const completedRuns = useMemo(() => runs.filter((r) => r.status === 'completed'), [runs]);
  const latestRun = completedRuns[0] ?? runs[0];
  const latestNiche = latestRun ? niches.find((n) => n.id === latestRun.niche_id) : undefined;

  const { data: latestIdeas = [], isLoading: ideasLoading } = useQuery<IdeaSummary[]>({
    queryKey: ['client-tab-latest-ideas', latestRun?.id],
    enabled: !!latestRun?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select('id, run_id, idea_number, title, hook, caption, target_platform, rating, status, is_wildcard, duration_seconds')
        .eq('run_id', latestRun!.id)
        .order('idea_number')
        .limit(6);
      if (error) throw error;
      return (data ?? []) as IdeaSummary[];
    },
  });

  if (accessLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!hasAccess) {
    return <ContentLabPaywall />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Content Lab</h2>
          <p className="text-xs text-muted-foreground">
            {niches.length} niche{niches.length === 1 ? '' : 's'} · {runs.length} run{runs.length === 1 ? '' : 's'}
            {allIdeas.length > 0 && ` · ${allIdeas.length} ideas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/content-lab')}>
            All niches & runs <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
          {canGenerate && (
            <Button size="sm" onClick={() => navigate('/content-lab/niche/new')}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New niche
            </Button>
          )}
        </div>
      </div>

      {!latestRun ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="h-7 w-7 text-muted-foreground" />
          <h3 className="font-display text-lg">No runs yet for this client</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Create a niche on the Content Lab launchpad and trigger your first report.
          </p>
          <Button onClick={() => navigate('/content-lab')} size="sm">
            <Plus className="mr-2 h-3.5 w-3.5" /> Open Content Lab
          </Button>
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Latest run</p>
              <h3 className="mt-1 font-display text-lg">
                {latestNiche?.label ?? 'Untitled niche'}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(latestRun.created_at).toLocaleString()} · {latestRun.status}
              </p>
            </div>
            {latestRun.status === 'completed' && (
              <Button onClick={() => navigate(`/content-lab/run/${latestRun.id}`)}>
                <FileText className="mr-2 h-4 w-4" /> Open full report
              </Button>
            )}
          </Card>

          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <h3 className="font-display text-lg">Top ideas from this run</h3>
              {latestIdeas.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/content-lab/run/${latestRun.id}`)}>
                  See all {allIdeas.length} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {ideasLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : latestIdeas.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                {latestRun.status === 'completed' ? (
                  <>No ideas in this run.</>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ideas will appear here once the run completes.
                  </span>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {latestIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={{
                      ...idea,
                      client_id: clientId,
                      niche_id: latestNiche?.id ?? null,
                      client_name: null,
                      niche_label: latestNiche?.label ?? null,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {runs.length > 1 && (
            <Card className="p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Previous runs
              </p>
              <div className="space-y-1">
                {runs.slice(1, 6).map((r) => {
                  const niche = niches.find((n) => n.id === r.niche_id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => r.status === 'completed' && navigate(`/content-lab/run/${r.id}`)}
                      className="flex w-full items-center justify-between rounded-md p-2 text-left text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{niche?.label ?? 'Run'}</span>
                        <span className="ml-2 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ClientContentLabTab;
