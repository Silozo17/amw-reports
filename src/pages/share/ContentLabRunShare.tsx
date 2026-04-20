import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ExternalLink } from 'lucide-react';

interface SharedIdea {
  id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  visual_direction: string | null;
  target_platform: string | null;
  is_wildcard: boolean;
  hashtags: string[];
}

interface SharedPost {
  thumbnail_url: string | null;
  post_url: string | null;
  author_handle: string;
  views: number;
  engagement_rate: number;
  platform: string;
}

interface SharedPayload {
  run: { id: string; summary: Record<string, unknown>; completed_at: string | null; created_at: string };
  client_name: string;
  org_logo: string | null;
  org_primary_color: string | null;
  ideas: SharedIdea[];
  top_posts: SharedPost[];
}

const ContentLabRunShare = () => {
  const { slug } = useParams<{ slug: string }>();
  const highlightedIdeaId = new URLSearchParams(window.location.search).get('idea');

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-run', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shared_run', { _slug: slug! });
      if (error) throw error;
      return data as unknown as SharedPayload | null;
    },
  });

  // Fire-and-forget view recording
  useEffect(() => {
    if (!slug || !data) return;
    supabase.rpc('record_share_view', { _slug: slug }).then(() => undefined);
  }, [slug, data]);

  // Scroll to highlighted idea once data is loaded
  useEffect(() => {
    if (!data || !highlightedIdeaId) return;
    const el = document.getElementById(`idea-${highlightedIdeaId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [data, highlightedIdeaId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-xl font-display mb-2">Link expired or invalid</h1>
          <p className="text-sm text-muted-foreground">
            This share link is no longer active. Please request a new one.
          </p>
        </Card>
      </div>
    );
  }

  const { client_name, org_logo, ideas, top_posts } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6 flex items-center gap-4">
          {org_logo ? (
            <img src={org_logo} alt="" className="h-10 w-10 rounded object-contain" />
          ) : (
            <div className="h-10 w-10 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Content brief</p>
            <h1 className="text-xl font-display truncate">{client_name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <section>
          <h2 className="text-lg font-display mb-4">Content ideas ({ideas.length})</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {ideas.map((idea) => (
              <Card
                key={idea.id}
                id={`idea-${idea.id}`}
                className={`p-5 space-y-3 transition-shadow ${
                  highlightedIdeaId === idea.id ? 'ring-2 ring-primary shadow-lg' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base leading-tight">{idea.title}</h3>
                  {idea.is_wildcard && <Badge variant="secondary">Wildcard</Badge>}
                </div>
                {idea.hook && (
                  <p className="text-sm text-foreground/80">
                    <span className="text-xs uppercase text-muted-foreground block mb-1">Hook</span>
                    {idea.hook}
                  </p>
                )}
                {idea.caption && (
                  <p className="text-sm text-foreground/70 line-clamp-3">{idea.caption}</p>
                )}
                {idea.target_platform && (
                  <Badge variant="outline" className="text-xs capitalize">{idea.target_platform}</Badge>
                )}
              </Card>
            ))}
          </div>
        </section>

        {top_posts.length > 0 && (
          <section>
            <h2 className="text-lg font-display mb-4">Top performing references</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              {top_posts.map((p, i) => (
                <a
                  key={i}
                  href={p.post_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block aspect-[9/16] rounded-md overflow-hidden bg-muted relative"
                >
                  {p.thumbnail_url ? (
                    <img
                      src={p.thumbnail_url}
                      alt={`@${p.author_handle}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-white">
                    @{p.author_handle}
                    <br />
                    {p.views.toLocaleString()} views
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-6 border-t border-border text-xs text-muted-foreground text-center">
          Read-only content brief
        </footer>
      </main>
    </div>
  );
};

export default ContentLabRunShare;
