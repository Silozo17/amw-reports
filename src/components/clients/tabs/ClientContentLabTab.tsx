import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentLabRuns } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';

interface Props { clientId: string }

/** Per-client Content Lab tab — links to the global launchpad and the latest run for this client. */
const ClientContentLabTab = ({ clientId }: Props) => {
  const navigate = useNavigate();
  const { hasAccess, isLoading } = useContentLabAccess();
  const { data: runs = [] } = useContentLabRuns(clientId);
  const latest = runs[0];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!hasAccess) return <ContentLabPaywall />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Content Lab</h2>
          <p className="text-xs text-muted-foreground">
            {runs.length} run{runs.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => navigate('/content-lab')}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Generate ideas
        </Button>
      </div>

      {!latest ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="h-7 w-7 text-muted-foreground" />
          <h3 className="font-display text-lg">No runs yet</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Head to Content Lab to generate research-backed content ideas for this client.
          </p>
          <Button onClick={() => navigate('/content-lab')}>Open Content Lab</Button>
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Latest run</p>
            <h3 className="mt-1 font-display text-lg">{new Date(latest.created_at).toLocaleString()}</h3>
            <Badge variant="outline" className="mt-1 capitalize text-[10px]">{latest.status}</Badge>
          </div>
          <Button onClick={() => navigate(`/content-lab/run/${latest.id}`)}>
            <FileText className="mr-2 h-4 w-4" /> Open run
          </Button>
        </Card>
      )}

      {runs.length > 1 && (
        <Card className="p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Previous runs</p>
          <div className="space-y-1">
            {runs.slice(1, 6).map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/content-lab/run/${r.id}`)}
                className="flex w-full items-center justify-between rounded-md p-2 text-left text-xs transition-colors hover:bg-muted/40"
              >
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
                <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ClientContentLabTab;
