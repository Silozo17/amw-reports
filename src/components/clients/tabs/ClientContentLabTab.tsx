import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Play, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentLabNiches, useContentLabRuns, useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import IdeaPipelineBoard from '@/components/content-lab/IdeaPipelineBoard';

interface ClientContentLabTabProps {
  clientId: string;
}

const ClientContentLabTab = ({ clientId }: ClientContentLabTabProps) => {
  const navigate = useNavigate();
  const { hasAccess, canGenerate, isLoading: accessLoading } = useContentLabAccess();
  const { data: niches = [], isLoading: nichesLoading } = useContentLabNiches(clientId);
  const { data: runs = [], isLoading: runsLoading } = useContentLabRuns(clientId);
  const { data: ideas = [] } = useAllIdeas(clientId);

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">Niches & runs</h2>
          <p className="text-xs text-muted-foreground">{niches.length} niches · {runs.length} runs</p>
        </div>
        {canGenerate && (
          <Button size="sm" onClick={() => navigate('/content-lab/niche/new')}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New niche
          </Button>
        )}
      </div>

      {nichesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : niches.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No niches for this client yet.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {niches.map((n) => {
            const lastRun = runs.find((r) => r.niche_id === n.id);
            return (
              <Card
                key={n.id}
                className="cursor-pointer p-4 transition-colors hover:border-primary/40"
                onClick={() => navigate(`/content-lab/niche/${n.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base">{n.label}</h3>
                  {lastRun && <Badge variant="outline" className="capitalize text-[10px]">{lastRun.status}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastRun ? `Last run ${new Date(lastRun.created_at).toLocaleDateString()}` : 'No runs yet'}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-xl">Pipeline</h2>
        {runsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : ideas.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Ideas will appear here after the first run completes.
          </Card>
        ) : (
          <IdeaPipelineBoard
            runId={`client-${clientId}`}
            ideas={ideas.map((i) => ({
              id: i.id,
              idea_number: i.idea_number,
              title: i.title,
              hook: i.hook,
              target_platform: i.target_platform,
              rating: i.rating,
              status: i.status,
            }))}
            onSelect={(idea) => {
              const found = ideas.find((f) => f.id === idea.id);
              if (found) navigate(`/content-lab/run/${found.run_id}`);
            }}
          />
        )}
      </div>

      {runs.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-xl">Recent runs</h2>
          <div className="space-y-2">
            {runs.slice(0, 5).map((r) => {
              const nicheLabel = niches.find((n) => n.id === r.niche_id)?.label ?? 'Untitled';
              return (
                <Card
                  key={r.id}
                  className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:border-primary/40"
                  onClick={() => r.status === 'completed' && navigate(`/content-lab/run/${r.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{nicheLabel}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientContentLabTab;
