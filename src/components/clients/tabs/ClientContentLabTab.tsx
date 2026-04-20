import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContentLabNiches, useContentLabRuns, useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import IdeaPipelineBoard from '@/components/content-lab/IdeaPipelineBoard';
import ViralPostCard from '@/components/content-lab/ViralPostCard';
import HookLibrary from '@/components/content-lab/HookLibrary';
import { supabase } from '@/integrations/supabase/client';

interface ClientContentLabTabProps {
  clientId: string;
}

const ClientContentLabTab = ({ clientId }: ClientContentLabTabProps) => {
  const navigate = useNavigate();
  const { hasAccess, canGenerate, isLoading: accessLoading } = useContentLabAccess();
  const { data: niches = [], isLoading: nichesLoading } = useContentLabNiches(clientId);
  const { data: runs = [], isLoading: runsLoading } = useContentLabRuns(clientId);
  const { data: allIdeas = [] } = useAllIdeas(clientId);

  // Default to most recent completed run, falling back to most recent of any status.
  const completedRuns = useMemo(() => runs.filter((r) => r.status === 'completed'), [runs]);
  const defaultRunId =
    completedRuns[0]?.id ?? runs[0]?.id ?? null;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(defaultRunId);

  // Keep selection valid when runs load.
  const activeRunId = selectedRunId && runs.find((r) => r.id === selectedRunId) ? selectedRunId : defaultRunId;

  if (accessLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!hasAccess) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Sparkles className="h-7 w-7 text-muted-foreground" />
        <h3 className="font-display text-lg">Content Lab not enabled</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Add Content Lab to your subscription to generate viral content ideas tailored to this client's niche.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Content Lab</h2>
          <p className="text-xs text-muted-foreground">
            {niches.length} niche{niches.length === 1 ? '' : 's'} · {runs.length} run{runs.length === 1 ? '' : 's'}
            {completedRuns.length > 0 && ` · ${allIdeas.length} ideas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runs.length > 0 && (
            <Select
              value={activeRunId ?? undefined}
              onValueChange={(v) => setSelectedRunId(v)}
            >
              <SelectTrigger className="h-9 w-[260px] text-xs">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r) => {
                  const niche = niches.find((n) => n.id === r.niche_id);
                  const summary = (r.summary ?? {}) as { display_name?: string };
                  const label =
                    summary.display_name ??
                    `${niche?.label ?? 'Run'} · ${new Date(r.created_at).toLocaleDateString()}`;
                  return (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      <span className="capitalize">[{r.status}]</span> {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {canGenerate && (
            <Button size="sm" onClick={() => navigate('/content-lab/niche/new')}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New niche
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Niches & runs</TabsTrigger>
          <TabsTrigger value="own" disabled={!activeRunId}>Your content</TabsTrigger>
          <TabsTrigger value="feed" disabled={!activeRunId}>Viral feed</TabsTrigger>
          <TabsTrigger value="ideas" disabled={!activeRunId}>Ideas</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="hooks" disabled={!activeRunId}>Hook library</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <NichesAndRunsList
            niches={niches}
            runs={runs}
            nichesLoading={nichesLoading}
            runsLoading={runsLoading}
            onPickRun={(runId) => setSelectedRunId(runId)}
          />
        </TabsContent>

        <TabsContent value="own">
          {activeRunId && <RunPostsTab runId={activeRunId} bucket="own" />}
        </TabsContent>

        <TabsContent value="feed">
          {activeRunId && <RunPostsTab runId={activeRunId} bucket="benchmark" />}
        </TabsContent>

        <TabsContent value="ideas">
          {activeRunId && <RunIdeasTab runId={activeRunId} />}
        </TabsContent>

        <TabsContent value="pipeline">
          {allIdeas.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Ideas will appear here after the first run completes.
            </Card>
          ) : (
            <IdeaPipelineBoard
              runId={`client-${clientId}`}
              ideas={allIdeas.map((i) => ({
                id: i.id,
                idea_number: i.idea_number,
                title: i.title,
                hook: i.hook,
                target_platform: i.target_platform,
                rating: i.rating,
                status: i.status,
              }))}
              onSelect={(idea) => {
                const found = allIdeas.find((f) => f.id === idea.id);
                if (found) navigate(`/content-lab/run/${found.run_id}`);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="hooks">
          {activeRunId && <RunHooksTab runId={activeRunId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface NicheRow {
  id: string;
  label: string;
}
interface RunRow {
  id: string;
  niche_id: string;
  status: string;
  created_at: string;
  summary?: Record<string, unknown> | null;
}

const NichesAndRunsList = ({
  niches,
  runs,
  nichesLoading,
  runsLoading,
  onPickRun,
}: {
  niches: NicheRow[];
  runs: RunRow[];
  nichesLoading: boolean;
  runsLoading: boolean;
  onPickRun: (runId: string) => void;
}) => {
  if (nichesLoading || runsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {niches.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No niches for this client yet.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {niches.map((n) => {
            const lastRun = runs.find((r) => r.niche_id === n.id);
            return (
              <Card key={n.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base">{n.label}</h3>
                  {lastRun && (
                    <Badge variant="outline" className="capitalize text-[10px]">{lastRun.status}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastRun ? `Last run ${new Date(lastRun.created_at).toLocaleDateString()}` : 'No runs yet'}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {runs.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-sm uppercase tracking-wider text-muted-foreground">Runs</h3>
          <div className="space-y-2">
            {runs.slice(0, 10).map((r) => {
              const niche = niches.find((n) => n.id === r.niche_id);
              const summary = (r.summary ?? {}) as { display_name?: string; description?: string };
              const created = new Date(r.created_at);
              const monthLabel = created.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
              const title = summary.display_name ?? `${niche?.label ?? 'Run'} · ${monthLabel}`;
              const subtitle = summary.description ?? created.toLocaleString();
              return (
                <Card
                  key={r.id}
                  className="flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:border-primary/40"
                  onClick={() => r.status === 'completed' && onPickRun(r.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                    {r.status === 'completed' && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const RunPostsTab = ({ runId, bucket }: { runId: string; bucket: 'own' | 'benchmark' }) => {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['client-tab-posts', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('*')
        .eq('run_id', runId)
        .order('views', { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  // Same bucket-fallback logic as RunDetailPage.
  const filtered = posts.filter((p) => {
    const b = (p as { bucket?: string | null }).bucket;
    if (bucket === 'own') return b === 'own';
    return b !== 'own'; // null / 'benchmark' / 'competitor' all show in viral feed
  });

  if (filtered.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        {bucket === 'own'
          ? 'No own posts scraped yet for this run.'
          : 'No viral posts yet for this run.'}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filtered.map((p) => (
        <ViralPostCard key={p.id} post={p} />
      ))}
    </div>
  );
};

const RunIdeasTab = ({ runId }: { runId: string }) => {
  const navigate = useNavigate();
  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ['client-tab-ideas', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select('*')
        .eq('run_id', runId)
        .order('idea_number');
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (ideas.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Ideas will appear here once the run completes.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Showing {ideas.length} ideas. Open the full report for hook variants, scripts, and previews.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {ideas.map((idea) => (
          <Card key={idea.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Idea {idea.idea_number}
                </p>
                <h4 className="mt-1 font-display text-base">{idea.title}</h4>
              </div>
              <div className="flex flex-col items-end gap-1">
                {(idea as { is_wildcard?: boolean }).is_wildcard && (
                  <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>
                )}
                {idea.target_platform && (
                  <Badge variant="outline" className="text-[10px] capitalize">{idea.target_platform}</Badge>
                )}
              </div>
            </div>
            {idea.hook && (
              <p className="text-sm">
                <span className="font-semibold">Hook: </span>
                {idea.hook}
              </p>
            )}
            {idea.why_it_works && (
              <p className="text-xs text-muted-foreground line-clamp-2">{idea.why_it_works}</p>
            )}
          </Card>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate(`/content-lab/run/${runId}`)}>
        Open full report
      </Button>
    </div>
  );
};

const RunHooksTab = ({ runId }: { runId: string }) => {
  const { data: hooksData, isLoading } = useQuery({
    queryKey: ['client-tab-hooks', runId],
    queryFn: async () => {
      const [hooksRes, postsRes, ideasRes] = await Promise.all([
        supabase
          .from('content_lab_hooks')
          .select('hook_text, mechanism, why_it_works, source_post_id')
          .eq('run_id', runId),
        supabase
          .from('content_lab_posts')
          .select('id, author_handle, post_url')
          .eq('run_id', runId),
        supabase
          .from('content_lab_ideas')
          .select('idea_number, hook, hook_variants')
          .eq('run_id', runId)
          .order('idea_number'),
      ]);
      if (hooksRes.error) throw hooksRes.error;
      if (postsRes.error) throw postsRes.error;
      if (ideasRes.error) throw ideasRes.error;

      const postMap = new Map((postsRes.data ?? []).map((p) => [p.id, p]));
      const analysedHooks = (hooksRes.data ?? []).map((h) => {
        const sp = h.source_post_id ? postMap.get(h.source_post_id) : null;
        return {
          hook_text: h.hook_text,
          mechanism: h.mechanism,
          why_it_works: h.why_it_works,
          source_handle: sp?.author_handle ?? null,
          source_url: sp?.post_url ?? null,
        };
      });
      const ideas = (ideasRes.data ?? []).map((i) => ({
        idea_number: i.idea_number,
        hook: i.hook ?? null,
        hook_variants:
          (i.hook_variants as Array<{ text: string; mechanism: string; why: string }> | null) ?? null,
      }));
      return { analysedHooks, ideas };
    },
  });

  if (isLoading || !hooksData) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  return <HookLibrary analysedHooks={hooksData.analysedHooks} ideas={hooksData.ideas} />;
};

export default ClientContentLabTab;
