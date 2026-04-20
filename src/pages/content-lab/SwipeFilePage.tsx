import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, FileText, Search, ExternalLink } from 'lucide-react';
import { useSwipeFile, useToggleSwipe, type SwipeFileIdea } from '@/hooks/useSwipeFile';
import PatternInsightsWidget from '@/components/content-lab/PatternInsightsWidget';
import usePageMeta from '@/hooks/usePageMeta';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ALL = '__all__';

const SwipeFilePage = () => {
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useSwipeFile();
  const toggle = useToggleSwipe();
  const [clientFilter, setClientFilter] = useState(ALL);
  const [platformFilter, setPlatformFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.idea_id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach((e) => next.delete(e.idea_id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((e) => next.add(e.idea_id));
      setSelected(next);
    }
  };

  const exportSelected = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one idea');
      return;
    }
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-lab-export-docx', {
        body: { idea_ids: Array.from(selected) },
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <Heart className="h-3.5 w-3.5" /> Swipe File
            </div>
            <h1 className="mt-2 font-display text-3xl">Your saved ideas, in one place.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved {entries.length} {entries.length === 1 ? 'idea' : 'ideas'}. Filter, group and export when you're ready.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={exportSelected} disabled={selected.size === 0 || exporting}>
              <FileText className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting…' : `Export ${selected.size || ''} selected`.trim()}
            </Button>
          </div>
        </header>

        <PatternInsightsWidget totalIdeas={entries.length} />

        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search hooks, titles, captions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All clients</SelectItem>
                {clients.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger><SelectValue placeholder="All platforms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtered.length > 0 && (
            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} id="select-all" />
              <label htmlFor="select-all" className="text-xs text-muted-foreground">
                Select all {filtered.length} visible
              </label>
            </div>
          )}
        </Card>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-medium">
              {entries.length === 0 ? 'No saved ideas yet' : 'No matches for these filters'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {entries.length === 0
                ? 'Tap the heart on any idea to save it here.'
                : 'Try clearing a filter or your search.'}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <SwipeCard
                key={e.id}
                entry={e}
                selected={selected.has(e.idea_id)}
                onToggleSelect={() => {
                  const next = new Set(selected);
                  next.has(e.idea_id) ? next.delete(e.idea_id) : next.add(e.idea_id);
                  setSelected(next);
                }}
                onOpen={() => e.idea && navigate(`/content-lab/run/${e.idea.run_id}`)}
                onRemove={() =>
                  toggle.mutate({
                    ideaId: e.idea_id,
                    clientId: e.client_id,
                    nicheId: e.niche_id,
                    isSaved: true,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const SwipeCard = ({
  entry, selected, onToggleSelect, onOpen, onRemove,
}: {
  entry: SwipeFileIdea;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) => {
  if (!entry.idea) return null;
  return (
    <Card className="space-y-3 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="mt-1" />
        <div className="flex-1">
          <div className="flex flex-wrap gap-1">
            {entry.idea.is_wildcard && (
              <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>
            )}
            {entry.idea.target_platform && (
              <Badge variant="outline" className="text-[10px] capitalize">{entry.idea.target_platform}</Badge>
            )}
            {entry.client && (
              <Badge variant="outline" className="text-[10px]">{entry.client.company_name}</Badge>
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-snug line-clamp-3">
            {entry.idea.hook ?? entry.idea.title}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-destructive hover:opacity-70"
          aria-label="Remove from swipe file"
        >
          <Heart className="h-4 w-4 fill-destructive" />
        </button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Saved {new Date(entry.saved_at).toLocaleDateString()}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpen}>
          Open <ExternalLink className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
};

export default SwipeFilePage;
