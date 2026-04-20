import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import usePageMeta from '@/hooks/usePageMeta';

interface HookRow {
  id: string;
  run_id: string;
  hook_text: string;
  mechanism: string | null;
  why_it_works: string | null;
  source_post_id: string | null;
  created_at: string;
  content_lab_runs: {
    org_id: string;
    content_lab_niches: { label: string } | null;
  } | null;
}

const HookLibraryPage = () => {
  usePageMeta({ title: 'Hook Library', description: 'All hooks discovered across your Content Lab runs.' });
  const { orgId } = useOrg();
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState<string>('all');

  const { data: hooks = [], isLoading } = useQuery<HookRow[]>({
    queryKey: ['content-lab-hooks-all', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_hooks')
        .select(`
          id, run_id, hook_text, mechanism, why_it_works, source_post_id, created_at,
          content_lab_runs!inner ( org_id, content_lab_niches ( label ) )
        `)
        .eq('content_lab_runs.org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HookRow[];
    },
  });

  const niches = useMemo(() => {
    const set = new Set<string>();
    hooks.forEach((h) => {
      const lbl = h.content_lab_runs?.content_lab_niches?.label;
      if (lbl) set.add(lbl);
    });
    return [...set].sort();
  }, [hooks]);

  const filtered = useMemo(() => {
    return hooks.filter((h) => {
      if (search && !h.hook_text.toLowerCase().includes(search.toLowerCase())) return false;
      if (niche !== 'all' && h.content_lab_runs?.content_lab_niches?.label !== niche) return false;
      return true;
    });
  }, [hooks, search, niche]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Content Lab</p>
          <h1 className="mt-2 font-display text-3xl">Hook Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every hook discovered across all your runs — searchable and filterable.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search hooks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All niches</SelectItem>
              {niches.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title="No hooks yet"
            description="Generate a Content Lab run to start building your hook library."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((h) => (
              <Card key={h.id} className="space-y-2 p-4">
                <p className="font-medium leading-snug">{h.hook_text}</p>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  {h.mechanism && (
                    <Badge variant="outline" className="uppercase">{h.mechanism}</Badge>
                  )}
                  {h.content_lab_runs?.content_lab_niches?.label && (
                    <Badge variant="secondary">{h.content_lab_runs.content_lab_niches.label}</Badge>
                  )}
                </div>
                {h.why_it_works && (
                  <p className="text-xs text-muted-foreground">{h.why_it_works}</p>
                )}
                <Link
                  to={`/content-lab/run/${h.run_id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View source run
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HookLibraryPage;
