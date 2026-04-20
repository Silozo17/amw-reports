import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Search, ExternalLink } from 'lucide-react';
import { useAllIdeas } from '@/hooks/useContentLab';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import usePageMeta from '@/hooks/usePageMeta';

const ALL = '__all__';
type SortKey = 'recent' | 'rating';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  scripted: 'Scripted',
  filming: 'Filming',
  posted: 'Posted',
  archived: 'Archived',
};

const IdeasLibraryPage = () => {
  const navigate = useNavigate();
  const { canGenerate, isLoading } = useContentLabAccess();
  const { data: ideas = [], isLoading: ideasLoading } = useAllIdeas();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState(ALL);
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
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
      if (statusFilter !== ALL && i.status !== statusFilter) return false;
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
  }, [ideas, search, clientFilter, platformFilter, statusFilter, sort]);

  if (!isLoading && !canGenerate) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl p-8">
          <Card className="p-10 text-center">
            <h1 className="font-display text-2xl">Ideas library is read-only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Re-activate Content Lab to generate new ideas. Existing ideas stay available in your pipeline.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> Ideas
          </div>
          <h1 className="mt-2 font-display text-3xl">Your full idea library</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} of {ideas.length} ideas</p>
        </header>

        <Card className="grid gap-3 p-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, hook, niche…" className="pl-9" />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients.map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All platforms</SelectItem>
              {platforms.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="rating">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {ideasLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No ideas match these filters.</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => (
              <Card key={i.id} className="flex items-center gap-3 p-3 transition-colors hover:border-primary/40">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-muted text-xs font-semibold">
                  #{i.idea_number}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.hook ?? i.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {i.client_name} · {i.niche_label}
                    {i.target_platform && <> · <span className="capitalize">{i.target_platform}</span></>}
                  </p>
                </div>
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{STATUS_LABELS[i.status] ?? i.status}</Badge>
                {i.rating != null && (
                  <span className="hidden text-xs text-muted-foreground md:inline">★ {i.rating}/10</span>
                )}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/content-lab/run/${i.run_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default IdeasLibraryPage;
