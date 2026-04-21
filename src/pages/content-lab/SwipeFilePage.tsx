import { useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
// Card import removed — page uses IdeaCard + EmptyStateMascot only.
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, FileText } from 'lucide-react';
import { useSwipeFile } from '@/hooks/useSwipeFile';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import PatternInsightsWidget from '@/components/content-lab/PatternInsightsWidget';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import IdeaCard from '@/components/content-lab/IdeaCard';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabFilterBar from '@/components/content-lab/ContentLabFilterBar';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import usePageMeta from '@/hooks/usePageMeta';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ALL = '__all__';

const SwipeFilePage = () => {
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const { data: entries = [], isLoading } = useSwipeFile();
  const [clientFilter, setClientFilter] = useState(ALL);
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  usePageMeta({ title: 'Swipe File', description: 'Your saved ideas, ready to action.' });

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => e.client && map.set(e.client.id, e.client.company_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.idea?.target_platform && set.add(e.idea.target_platform));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (!e.idea) return false;
      if (clientFilter !== ALL && e.client_id !== clientFilter) return false;
      if (platformFilter !== ALL && e.idea.target_platform !== platformFilter) return false;
      if (search) {
        const hay = `${e.idea.title} ${e.idea.hook ?? ''} ${e.idea.caption ?? ''}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, clientFilter, platformFilter, search]);

  const exportAll = async () => {
    if (filtered.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-export-docx', {
        body: { idea_ids: filtered.map((e) => e.idea_id) },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Brief exported');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!accessLoading && !hasAccess) {
    return <AppLayout><ContentLabPaywall /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab · Swipe File"
          icon={Heart}
          title="Your saved ideas, in one place."
          subtitle={`${entries.length} ${entries.length === 1 ? 'idea' : 'ideas'} saved. Filter, group and export when ready.`}
          actions={
            <Button onClick={exportAll} disabled={filtered.length === 0 || exporting}>
              <FileText className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting…' : `Export ${filtered.length} as brief`}
            </Button>
          }
        />

        <PatternInsightsWidget totalIdeas={entries.length} />

        <ContentLabFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search hooks, titles, captions…"
        >
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ContentLabFilterBar>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[420px]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title={entries.length === 0 ? 'No saved ideas yet' : 'No matches for these filters'}
            description={
              entries.length === 0
                ? 'Tap the heart on any idea to save it here. Your team can browse, tag and export them later.'
                : 'Try clearing a filter or your search.'
            }
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => e.idea && (
              <IdeaCard
                key={e.id}
                idea={{
                  id: e.idea.id,
                  run_id: e.idea.run_id,
                  client_id: e.client_id,
                  niche_id: e.niche_id,
                  client_name: e.client?.company_name ?? null,
                  niche_label: e.niche?.label ?? null,
                  idea_number: 0,
                  title: e.idea.title,
                  hook: e.idea.hook,
                  caption: e.idea.caption,
                  target_platform: e.idea.target_platform,
                  rating: e.idea.rating,
                  status: 'not_started',
                  is_wildcard: e.idea.is_wildcard,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SwipeFilePage;
