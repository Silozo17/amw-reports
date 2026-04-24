import { useMemo, useState } from 'react';
import { Heart, Sparkles, FileText, Anchor, Trash2, ExternalLink } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import UsageHeader from '@/components/content-lab/UsageHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import IgThumb from '@/components/content-lab/IgThumb';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import { useSaves, useDeleteSave, type SaveKind, type SavedItem } from '@/hooks/useContentLabSaves';
import usePageMeta from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils';

const TABS: Array<{ key: SaveKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'idea', label: 'Ideas' },
  { key: 'post', label: 'Posts' },
  { key: 'hook', label: 'Hooks' },
];

const SavesPage = () => {
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();
  const [activeTab, setActiveTab] = useState<SaveKind | 'all'>('all');
  const { data: saves = [], isLoading } = useSaves(activeTab === 'all' ? undefined : activeTab);
  const del = useDeleteSave();

  usePageMeta({ title: 'Saves · Content Lab', description: 'Your saved ideas, posts, and hooks.' });

  const counts = useMemo(() => {
    const c = { all: saves.length, idea: 0, post: 0, hook: 0 } as Record<string, number>;
    saves.forEach((s) => { c[s.kind] = (c[s.kind] ?? 0) + 1; });
    return c;
  }, [saves]);

  if (accessLoading) return <AppLayout><p className="p-8 text-sm text-muted-foreground">Loading…</p></AppLayout>;
  if (!hasAccess) return <AppLayout><ContentLabPaywall /></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab"
          icon={Heart}
          title="Saves"
          subtitle="Your saved ideas, posts, and hooks — across every client and run."
          actions={<UsageHeader />}
        />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeTab === t.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {t.label}
              <span className="rounded-full bg-background/30 px-1.5 py-0.5 text-[10px]">
                {t.key === 'all' ? counts.all : counts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : saves.length === 0 ? (
          <Card className="p-10 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg">Nothing saved yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open any run and click the heart on ideas, posts, or hooks to save them here.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {saves.map((s) => (
              <SaveCard key={s.id} save={s} onDelete={() => del.mutate(s.id)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const KIND_META: Record<SaveKind, { icon: typeof Sparkles; label: string }> = {
  idea: { icon: Sparkles, label: 'Idea' },
  post: { icon: FileText, label: 'Post' },
  hook: { icon: Anchor, label: 'Hook' },
};

const SaveCard = ({ save, onDelete }: { save: SavedItem; onDelete: () => void }) => {
  const meta = KIND_META[save.kind];
  const Icon = meta.icon;
  const p = save.payload as Record<string, unknown>;

  const title =
    (p.title as string | undefined) ??
    (p.hook_text as string | undefined) ??
    (p.caption as string | undefined)?.slice(0, 80) ??
    'Saved item';
  const subtitle =
    (p.hook as string | undefined) ??
    (p.author_handle ? `@${p.author_handle}` : undefined) ??
    (p.example_caption as string | undefined);
  const url = (p.post_url as string | undefined) ?? (p.example_post_url as string | undefined);
  const thumbnail = p.thumbnail_url as string | undefined;

  return (
    <Card className="flex flex-col gap-2 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {thumbnail && (
        <IgThumb src={thumbnail} alt={title} className="aspect-video rounded-md" />
      )}
      <p className="font-display text-sm leading-tight">{title}</p>
      {subtitle && <p className="line-clamp-3 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
        <span>{new Date(save.created_at).toLocaleDateString()}</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
};

export default SavesPage;
