import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
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

interface TrendRow {
  id: string;
  run_id: string;
  label: string;
  description: string | null;
  momentum: string | null;
  recommendation: string | null;
  verification_source: string | null;
  verification_url: string | null;
  created_at: string;
  content_lab_runs: {
    org_id: string;
    content_lab_niches: { label: string } | null;
  } | null;
}

const momentumIcon = (m: string | null) => {
  const v = (m ?? '').toLowerCase();
  if (v.includes('rising')) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (v.includes('fading')) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

const TrendsLibraryPage = () => {
  usePageMeta({ title: 'Content Lab Trends', description: 'Cross-run trend signals across your niches.' });
  const { orgId } = useOrg();
  const [search, setSearch] = useState('');
  const [momentum, setMomentum] = useState<string>('all');
  const [niche, setNiche] = useState<string>('all');

  const { data: trends = [], isLoading } = useQuery<TrendRow[]>({
    queryKey: ['content-lab-trends-all', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_trends')
        .select(`
          id, run_id, label, description, momentum, recommendation,
          verification_source, verification_url, created_at,
          content_lab_runs!inner ( org_id, content_lab_niches ( label ) )
        `)
        .eq('content_lab_runs.org_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrendRow[];
    },
  });

  const niches = useMemo(() => {
    const set = new Set<string>();
    trends.forEach((t) => {
      const lbl = t.content_lab_runs?.content_lab_niches?.label;
      if (lbl) set.add(lbl);
    });
    return [...set].sort();
  }, [trends]);

  const filtered = useMemo(() => {
    return trends.filter((t) => {
      if (search && !`${t.label} ${t.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (momentum !== 'all' && !(t.momentum ?? '').toLowerCase().includes(momentum)) return false;
      if (niche !== 'all' && t.content_lab_runs?.content_lab_niches?.label !== niche) return false;
      return true;
    });
  }, [trends, search, momentum, niche]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Content Lab</p>
          <h1 className="mt-2 font-display text-3xl">Trends</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live trend signals detected across all your niches and runs.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search trends…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={momentum} onValueChange={setMomentum}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Momentum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All momentum</SelectItem>
              <SelectItem value="rising">Rising</SelectItem>
              <SelectItem value="steady">Steady</SelectItem>
              <SelectItem value="fading">Fading</SelectItem>
            </SelectContent>
          </Select>
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
            title="No trends yet"
            description="Trends will appear here as Content Lab runs detect them across your niches."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card key={t.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base leading-tight">{t.label}</h3>
                  <Badge variant="outline" className="flex shrink-0 items-center gap-1 text-[10px] capitalize">
                    {momentumIcon(t.momentum)}
                    {t.momentum ?? 'unknown'}
                  </Badge>
                </div>
                {t.content_lab_runs?.content_lab_niches?.label && (
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.content_lab_runs.content_lab_niches.label}
                  </p>
                )}
                {t.description && <p className="text-sm text-foreground/80">{t.description}</p>}
                {t.recommendation && (
                  <div className="rounded-md bg-primary/5 p-2 text-xs">
                    <span className="font-semibold text-primary">Recommendation: </span>
                    {t.recommendation}
                  </div>
                )}
                {t.verification_url && (
                  <a
                    href={t.verification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> {t.verification_source ?? 'Source'}
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TrendsLibraryPage;
