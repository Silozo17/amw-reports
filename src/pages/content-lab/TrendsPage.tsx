import { TrendingUp, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import UsageHeader from '@/components/content-lab/UsageHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useTrends, useDeleteTrend } from '@/hooks/useContentLabSaves';
import usePageMeta from '@/hooks/usePageMeta';

const TrendsPage = () => {
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const { data: trends = [], isLoading } = useTrends();
  const del = useDeleteTrend();

  usePageMeta({ title: 'Trends · Content Lab', description: 'Recurring content patterns surfaced from your runs.' });

  if (accessLoading) return <AppLayout><p className="p-8 text-sm text-muted-foreground">Loading…</p></AppLayout>;
  if (!hasAccess) return <AppLayout><ContentLabPaywall /></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab"
          icon={TrendingUp}
          title="Trends"
          subtitle="Recurring patterns — formats, hooks, and topics — surfaced from your runs."
          actions={<UsageHeader />}
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : trends.length === 0 ? (
          <Card className="p-10 text-center">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg">No trends yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Trends appear here automatically after the analyse phase of each run.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trends.map((t) => {
              const evidence = Array.isArray(t.evidence) ? t.evidence : [];
              return (
                <Card key={t.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="secondary" className="mb-2 text-[10px]">Pattern</Badge>
                      <h3 className="font-display text-base leading-tight">{t.label}</h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                  {evidence.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {evidence.slice(0, 6).map((e, i) => {
                        const ev = e as Record<string, unknown>;
                        const thumb = ev.thumbnail_url as string | undefined;
                        return (
                          <div key={i} className="aspect-square overflow-hidden rounded bg-muted">
                            {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-auto text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()} · {evidence.length} examples
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TrendsPage;
