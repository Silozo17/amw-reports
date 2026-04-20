import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanSquare } from 'lucide-react';
import { useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import IdeaPipelineBoard from '@/components/content-lab/IdeaPipelineBoard';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
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
    return <AppLayout><ContentLabPaywall /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab · Pipeline"
          icon={KanbanSquare}
          title="Every idea, every client."
          subtitle="Drag ideas from script to posted. Filter by client to focus."
          actions={
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All clients</SelectItem>
                {clients.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

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
