import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { toast } from 'sonner';

const STALE_HOURS = 24;

interface InsightRow {
  summary: string;
  ideas_count: number;
  generated_at: string;
  pattern_breakdown: Record<string, number>;
}

const PatternInsightsWidget = ({ totalIdeas }: { totalIdeas: number }) => {
  const { orgId } = useOrg();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['swipe-insights', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_swipe_insights')
        .select('summary, ideas_count, generated_at, pattern_breakdown')
        .eq('org_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as InsightRow | null;
    },
  });

  const isStale = (() => {
    if (!data) return true;
    const ageMs = Date.now() - new Date(data.generated_at).getTime();
    return ageMs > STALE_HOURS * 3600_000 || data.ideas_count !== totalIdeas;
  })();

  // Auto-refresh once on mount if stale and we have ≥3 ideas
  useEffect(() => {
    if (!isLoading && isStale && totalIdeas >= 3) {
      void refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isStale, totalIdeas]);

  const refresh = async (silent = false) => {
    try {
      const { error } = await supabase.functions.invoke('content-lab-swipe-insights', {});
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['swipe-insights', orgId] });
      if (!silent) toast.success('Insights refreshed');
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Refresh failed');
    }
  };

  if (totalIdeas < 3) {
    return (
      <Card className="border-dashed p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Save 3+ ideas to unlock pattern insights.
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your saved-ideas pattern
            </p>
            {isLoading ? (
              <Skeleton className="mt-2 h-5 w-80" />
            ) : (
              <p className="mt-1 text-sm font-medium leading-relaxed">
                {data?.summary ?? 'Generating your first insight…'}
              </p>
            )}
            {data && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Based on {data.ideas_count} saved {data.ideas_count === 1 ? 'idea' : 'ideas'}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh(false)} className="shrink-0">
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>
    </Card>
  );
};

export default PatternInsightsWidget;
