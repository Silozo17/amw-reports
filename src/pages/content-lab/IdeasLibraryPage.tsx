import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import IdeaCard from '@/components/content-lab/IdeaCard';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabFilterBar from '@/components/content-lab/ContentLabFilterBar';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import usePageMeta from '@/hooks/usePageMeta';

const ALL = '__all__';
type SortKey = 'recent' | 'rating';

const IdeasLibraryPage = () => {
  const { hasAccess, isLoading } = useContentLabAccess();
  const { data: ideas = [], isLoading: ideasLoading } = useAllIdeas();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState(ALL);
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [sort, setSort] = useState<SortKey>('recent');

  usePageMeta({ title: 'Ideas', description: 'Every content idea ever generated for your org.' });

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    ideas.forEach((i) => m.set(i.client_id, i.client_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ideas]);

  const platforms = useMemo(() => {
    const s = new Set<string>();
    ideas.forEach((i) => i.target_platform && s.add(i.target_platform));
    return [...s].sort();
  }, [ideas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = ideas.filter((i) => {
      if (clientFilter !== ALL && i.client_id !== clientFilter) return false;
      if (platformFilter !== ALL && i.target_platform !== platformFilter) return false;
      if (q) {
        const blob = `${i.title} ${i.hook ?? ''} ${i.niche_label}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'rating') {
      out = out.slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return out;
  }, [ideas, search, clientFilter, platformFilter, sort]);

  if (!isLoading && !hasAccess) {
    return <AppLayout><ContentLabPaywall /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab · Ideas"
          icon={Lightbulb}
          title="Your full idea library"
          subtitle={`${filtered.length} of ${ideas.length} ideas across every run.`}
        />

        <ContentLabFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search title, hook, niche…"
        >
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All platforms</SelectItem>
              {platforms.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="rating">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </ContentLabFilterBar>

        {ideasLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[420px]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title={ideas.length === 0 ? 'No ideas generated yet' : 'No ideas match these filters'}
            description={
              ideas.length === 0
                ? 'Run Content Lab on a niche to start filling your library.'
                : 'Try clearing a filter or your search.'
            }
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((i) => (
              <IdeaCard
                key={i.id}
                idea={{
                  id: i.id,
                  run_id: i.run_id,
                  client_id: i.client_id,
                  client_name: i.client_name,
                  niche_label: i.niche_label,
                  idea_number: i.idea_number,
                  title: i.title,
                  hook: i.hook,
                  target_platform: i.target_platform,
                  rating: i.rating,
                  status: i.status,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default IdeasLibraryPage;
