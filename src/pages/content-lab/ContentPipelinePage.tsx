import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanSquare } from 'lucide-react';
import { useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import IdeaPipelineBoard from '@/components/content-lab/IdeaPipelineBoard';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import usePageMeta from '@/hooks/usePageMeta';

const ALL = '__all__';

const ContentPipelinePage = () => {
  const navigate = useNavigate();
  const { hasAccess, isLoading } = useContentLabAccess();
  const [clientFilter, setClientFilter] = useState<string>(ALL);
  const { data: ideas = [], isLoading: ideasLoading } = useAllIdeas();

  usePageMeta({ title: 'Content Pipeline', description: 'Track every idea from script to posted.' });

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    ideas.forEach((i) => map.set(i.client_id, i.client_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ideas]);

  const filtered = useMemo(
    () => (clientFilter === ALL ? ideas : ideas.filter((i) => i.client_id === clientFilter)),
    [ideas, clientFilter],
  );

  if (!isLoading && !hasAccess) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl p-8">
          <Card className="p-10 text-center">
            <h1 className="font-display text-2xl">Content Lab not enabled</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pipeline is part of the Content Lab add-on. Enable it to track ideas across your clients.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <KanbanSquare className="h-3.5 w-3.5" /> Content Pipeline
            </div>
            <h1 className="mt-2 font-display text-3xl">Every idea, every client.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag ideas from script to posted. Filter by client to focus.
            </p>
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        {ideasLoading ? (
          <p className="text-sm text-muted-foreground">Loading ideas…</p>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title="Pipeline is empty"
            description="Generate your first run from Content Lab — ideas you create will land here so you can drag them from script to posted."
          />
        ) : (
          <SectionErrorBoundary>
            <IdeaPipelineBoard
              runId="aggregate"
              ideas={filtered.map((i) => ({
                id: i.id,
                idea_number: i.idea_number,
                title: i.title,
                hook: i.hook,
                target_platform: i.target_platform,
                rating: i.rating,
                status: i.status,
              }))}
              onSelect={(idea) => {
                const found = filtered.find((f) => f.id === idea.id);
                if (found) navigate(`/content-lab/run/${found.run_id}`);
              }}
            />
          </SectionErrorBoundary>
        )}
      </div>
    </AppLayout>
  );
};

export default ContentPipelinePage;
