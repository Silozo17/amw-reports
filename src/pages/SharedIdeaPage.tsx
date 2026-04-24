import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, MessageCircle, Send, Bookmark, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import usePageMeta from '@/hooks/usePageMeta';

interface SharedIdea {
  id: string;
  title: string;
  hook: string | null;
  hooks: string[] | null;
  caption: string | null;
  script: string | null;
  cta: string | null;
  hashtags: string[];
  best_fit_platform: string | null;
  why_it_works: string | null;
  visual_direction: string | null;
  like_count: number | null;
}

interface SharedOrg {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
}

const SharedIdeaPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [idea, setIdea] = useState<SharedIdea | null>(null);
  const [org, setOrg] = useState<SharedOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [hookIdx, setHookIdx] = useState(0);

  usePageMeta({ title: idea?.title ?? 'Content idea', description: idea?.hook ?? 'Shared content idea.' });

  useEffect(() => {
    if (!slug) return;
    void (async () => {
      const { data, error } = await supabase.rpc('get_shared_idea', { _slug: slug });
      if (error || !data) { setLoading(false); return; }
      const payload = data as { idea: SharedIdea; org: SharedOrg };
      setIdea(payload.idea);
      setOrg(payload.org);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading idea…</div>;
  }
  if (!idea) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="font-display text-2xl">Link not found</p>
          <p className="mt-2 text-sm text-muted-foreground">This shared idea may have been revoked or never existed.</p>
        </div>
      </div>
    );
  }

  const hooks = (idea.hooks ?? []).filter(Boolean).length > 0
    ? (idea.hooks ?? []).filter(Boolean)
    : (idea.hook ? [idea.hook] : []);

  const handle = (org?.name ?? 'your.brand').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {org?.logo_url
            ? <img src={org.logo_url} alt={org.name} className="h-8 w-auto" />
            : <div className="h-8 w-8 rounded-md bg-primary/20" />}
          <p className="font-display text-base">{org?.name ?? 'Content idea'}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Card className="p-4">
          <div className="mx-auto w-full max-w-[340px] rounded-[28px] border border-border bg-background p-2 shadow-lg">
            <div className="overflow-hidden rounded-[22px] border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-card" />
                </div>
                <p className="text-xs font-semibold">{handle}</p>
                <Badge variant="outline" className="ml-auto text-[9px] capitalize">
                  {idea.best_fit_platform ?? 'instagram'}
                </Badge>
              </div>
              <div className="relative aspect-square bg-gradient-to-br from-primary/15 via-background to-accent/10 p-4">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Hook</p>
                    <p className="mt-1 line-clamp-4 text-sm font-display leading-tight">
                      {hooks[hookIdx] ?? idea.title}
                    </p>
                  </div>
                  {idea.visual_direction && (
                    <p className="line-clamp-2 text-[10px] italic text-muted-foreground">🎬 {idea.visual_direction}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
                <Send className="h-5 w-5" />
                <Bookmark className="ml-auto h-5 w-5" />
              </div>
              {idea.caption && (
                <div className="px-3 pb-3 text-[11px]">
                  <span className="font-semibold">{handle}</span>{' '}
                  <span className="text-muted-foreground">{idea.caption}</span>
                </div>
              )}
            </div>
          </div>

          {hooks.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1">
              {hooks.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHookIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === hookIdx ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                  aria-label={`Hook ${i + 1}`}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h1 className="font-display text-2xl">{idea.title}</h1>
          </div>

          {hooks.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">3 Hooks</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {hooks.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
            </section>
          )}

          {idea.script && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Script</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{idea.script}</p>
            </section>
          )}

          {idea.caption && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Caption</p>
              <p className="mt-1 text-sm">{idea.caption}</p>
            </section>
          )}

          {idea.cta && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Call to action</p>
              <p className="mt-1 text-sm">{idea.cta}</p>
            </section>
          )}

          {idea.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.hashtags.map((h) => (
                <Badge key={h} variant="secondary" className="text-[10px]">#{h.replace(/^#/, '')}</Badge>
              ))}
            </div>
          )}

          {idea.why_it_works && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Why it works</p>
              <p className="mt-1 text-sm">{idea.why_it_works}</p>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Shared by {org?.name ?? 'your team'}.
        </p>
      </main>
    </div>
  );
};

export default SharedIdeaPage;
