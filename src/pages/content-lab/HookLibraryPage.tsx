import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Anchor } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabFilterBar from '@/components/content-lab/ContentLabFilterBar';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
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
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const { orgId } = useOrg();
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState<string>('all');

  const { data: hooks = [], isLoading } = useQuery<HookRow[]>({
    queryKey: ['content-lab-hooks-all', orgId],
    enabled: !!orgId && hasAccess,
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

  if (!accessLoading && !hasAccess) {
    return <AppLayout><ContentLabPaywall /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab · Hooks"
          icon={Anchor}
          title="Hook Library"
          subtitle="Every hook discovered across all your runs — searchable, filterable, ready to remix."
        />

        <ContentLabFilterBar search={search} onSearchChange={setSearch} placeholder="Search hooks…">
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All niches</SelectItem>
              {niches.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </ContentLabFilterBar>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title="No hooks yet"
            description="Generate a Content Lab run to start building your hook library."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((h) => (
              <Card
                key={h.id}
                className="space-y-2 border-border/60 bg-card/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <p className="font-medium leading-snug">{h.hook_text}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
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
