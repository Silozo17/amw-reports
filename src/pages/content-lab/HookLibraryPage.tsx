import { useMemo } from 'react';
import { Anchor, Trash2, ExternalLink } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import UsageHeader from '@/components/content-lab/UsageHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useHooks, useDeleteHook, type HookEntry } from '@/hooks/useContentLabSaves';
import usePageMeta from '@/hooks/usePageMeta';

const HookLibraryPage = () => {
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const { data: hooks = [], isLoading } = useHooks();
  const del = useDeleteHook();

  usePageMeta({ title: 'Hook Library · Content Lab', description: 'Your library of high-performing post hooks.' });

  const grouped = useMemo(() => {
    const m = new Map<string, HookEntry[]>();
    hooks.forEach((h) => {
      const key = h.hook_type || 'Uncategorised';
      m.set(key, [...(m.get(key) ?? []), h]);
    });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [hooks]);

  if (accessLoading) return <AppLayout><p className="p-8 text-sm text-muted-foreground">Loading…</p></AppLayout>;
  if (!hasAccess) return <AppLayout><ContentLabPaywall /></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab"
          icon={Anchor}
          title="Hook Library"
          subtitle="The opening lines that stopped scrolls — across every client and run."
          actions={<UsageHeader />}
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : hooks.length === 0 ? (
          <Card className="p-10 text-center">
            <Anchor className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg">No hooks saved yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              From any run, click "Save hook" on a post to start building your library.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([type, list]) => (
              <section key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base capitalize">{type}</h2>
                  <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((h) => (
                    <Card key={h.id} className="flex flex-col gap-2 p-4">
                      <p className="font-medium leading-snug">"{h.hook_text}"</p>
                      {h.example_caption && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {h.example_caption}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span className="capitalize">{h.platform ?? '—'}</span>
                        <div className="flex items-center gap-1">
                          {h.example_post_url && (
                            <a href={h.example_post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => del.mutate(h.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HookLibraryPage;
