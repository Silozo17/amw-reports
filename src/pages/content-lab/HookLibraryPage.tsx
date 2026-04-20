import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Copy, Flame } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyStateMascot from '@/components/content-lab/EmptyStateMascot';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabFilterBar from '@/components/content-lab/ContentLabFilterBar';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { supabase } from '@/integrations/supabase/client';
import usePageMeta from '@/hooks/usePageMeta';
import { toast } from 'sonner';

interface GlobalHookRow {
  id: string;
  hook_text: string;
  mechanism: string | null;
  why_it_works: string | null;
  niche_label: string | null;
  platform: string | null;
  author_handle: string | null;
  source_views: number | null;
  source_engagement_rate: number | null;
  performance_score: number | null;
  created_at: string;
}

const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'linkedin', 'threads', 'youtube'] as const;
const MECHANISMS = [
  'Curiosity gap', 'Negative', 'Social proof', 'Contrarian',
  'Pattern interrupt', 'Stat shock', 'Question', 'Story open',
] as const;
const SORTS = [
  { value: 'top', label: 'Top performing' },
  { value: 'newest', label: 'Newest' },
  { value: 'engagement', label: 'Most engagement' },
] as const;
const FETCH_LIMIT = 200;
const RANK_BADGE_LIMIT = 50;

const formatViews = (n: number | null) => {
  if (!n || n < 1000) return `${n ?? 0}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
};

const HookLibraryPage = () => {
  usePageMeta({
    title: 'Hook Library',
    description: 'Every hook from every Content Lab run across the platform — ranked by real engagement.',
  });
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState<string>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [mechanism, setMechanism] = useState<string>('all');
  const [sort, setSort] = useState<string>('top');

  const { data: hooks = [], isLoading } = useQuery<GlobalHookRow[]>({
    queryKey: ['global-hook-library', platform, mechanism],
    enabled: hasAccess,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_hook_library', {
        _niche: null,
        _platform: platform === 'all' ? null : platform,
        _mechanism: mechanism === 'all' ? null : mechanism,
        _limit: FETCH_LIMIT,
      });
      if (error) throw error;
      return (data ?? []) as GlobalHookRow[];
    },
  });

  const niches = useMemo(() => {
    const set = new Set<string>();
    hooks.forEach((h) => { if (h.niche_label) set.add(h.niche_label); });
    return [...set].sort();
  }, [hooks]);

  const filtered = useMemo(() => {
    const out = hooks.filter((h) => {
      if (search && !h.hook_text.toLowerCase().includes(search.toLowerCase())) return false;
      if (niche !== 'all' && h.niche_label !== niche) return false;
      return true;
    });
    if (sort === 'newest') {
      out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === 'engagement') {
      out.sort((a, b) => (b.source_engagement_rate ?? 0) - (a.source_engagement_rate ?? 0));
    } else {
      out.sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0));
    }
    return out;
  }, [hooks, search, niche, sort]);

  const topDecileScore = useMemo(() => {
    if (filtered.length < 10) return Infinity;
    const scores = [...filtered].map((h) => h.performance_score ?? 0).sort((a, b) => b - a);
    return scores[Math.floor(scores.length * 0.1)];
  }, [filtered]);

  const copyHook = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Hook copied');
    } catch {
      toast.error('Copy failed');
    }
  };

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
          subtitle="Every hook from every Content Lab run across the platform — ranked by real-world engagement. Filter by niche, platform or mechanism."
        />

        <ContentLabFilterBar search={search} onSearchChange={setSearch} placeholder="Search hooks…">
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All niches</SelectItem>
              {niches.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mechanism} onValueChange={setMechanism}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mechanism" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mechanisms</SelectItem>
              {MECHANISMS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </ContentLabFilterBar>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyStateMascot
            title="No hooks match these filters"
            description="Try a broader niche or platform — the library grows with every run across the platform."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((h, idx) => {
              const rank = idx + 1;
              const showRank = rank <= RANK_BADGE_LIMIT && sort === 'top';
              const isTopDecile = (h.performance_score ?? 0) >= topDecileScore;
              return (
                <Card
                  key={h.id}
                  className="flex flex-col gap-3 border-border/60 bg-card/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {showRank && (
                        <Badge variant="secondary" className="text-[10px] font-semibold">#{rank}</Badge>
                      )}
                      {isTopDecile && sort === 'top' && (
                        <Flame className="h-3.5 w-3.5 text-orange-500" aria-label="Top performing" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => copyHook(h.hook_text)}
                      aria-label="Copy hook"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="font-display text-base leading-snug">{h.hook_text}</p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {h.niche_label && <Badge variant="secondary">{h.niche_label}</Badge>}
                    {h.platform && (
                      <Badge variant="outline" className="capitalize">{h.platform}</Badge>
                    )}
                    {h.mechanism && (
                      <Badge variant="outline" className="uppercase">{h.mechanism}</Badge>
                    )}
                  </div>

                  {h.why_it_works && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{h.why_it_works}</p>
                  )}

                  {(h.author_handle || h.source_views) && (
                    <p className="mt-auto pt-1 text-[11px] text-muted-foreground/80">
                      {h.author_handle && <span>From @{h.author_handle}</span>}
                      {h.source_views ? <span> · {formatViews(h.source_views)} views</span> : null}
                      {h.source_engagement_rate
                        ? <span> · {(h.source_engagement_rate * 100).toFixed(1)}% ER</span>
                        : null}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HookLibraryPage;
