import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Lock,
  CheckCircle2,
  Lightbulb,
  Anchor,
  TrendingUp,
  KanbanSquare,
  Heart,
  Share2,
  Wand2,
  Search,
  ArrowRight,
  PlayCircle,
  Rocket,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CONTENT_LAB_DEMO_RUN_ID } from '@/lib/contentLabDemo';
import IdeaPreviewInstagram from './IdeaPreviewInstagram';
import ViralPostCard from './ViralPostCard';

interface DemoIdea {
  id: string;
  idea_number: number;
  title: string;
  hook: string | null;
  caption: string | null;
  target_platform: string | null;
  is_wildcard: boolean;
}

interface DemoPost {
  id: string;
  thumbnail_url: string | null;
  post_url: string | null;
  caption: string | null;
  author_handle: string;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  platform: string;
  hook_text: string | null;
}

const FEATURES = [
  {
    icon: Search,
    title: 'Viral Feed',
    body: 'Pull the highest-performing posts from your niche, your benchmarks and your competitors — last 60 days only.',
  },
  {
    icon: Wand2,
    title: '12 ready-to-film ideas',
    body: 'Every run produces 12 fully-built ideas: hook variants, scripts, CTAs, hashtags, visual direction.',
  },
  {
    icon: Anchor,
    title: 'Hook Library',
    body: 'Every hook discovered across all your runs, decoded with mechanism + why it works.',
  },
  {
    icon: TrendingUp,
    title: 'Live Trends',
    body: 'Trend signals with momentum (rising / steady / fading) and a recommended action per niche.',
  },
  {
    icon: KanbanSquare,
    title: 'Pipeline Kanban',
    body: 'Drag every idea from script → filming → posted across all clients on one board.',
  },
  {
    icon: Heart,
    title: 'Swipe File',
    body: 'Tap the heart on any idea — your team builds a shared library of favourites with pattern insights.',
  },
  {
    icon: Share2,
    title: 'Client sharing',
    body: 'White-labelled run share links, DOCX export, threaded comments per idea.',
  },
  {
    icon: Rocket,
    title: 'Wildcard + remix',
    body: 'Wildcard ideas push your zone of genius. Remix and regenerate any idea on demand.',
  },
];

const HOW_STEPS = [
  { icon: Search, title: '1. Discover', body: 'We scrape your niche, top benchmarks and competitors — only the last 60 days.' },
  { icon: Lightbulb, title: '2. Decode', body: 'AI analyses what is working and why — hooks, formats, momentum signals.' },
  { icon: Wand2, title: '3. Create', body: '12 ready-to-film ideas tailored to your brand voice — every month.' },
];

/**
 * Live read-only Content Lab demo, fed from a curated AMW Media run.
 * Replaces the ad-hoc "Content Lab not enabled" stubs across every sub-page.
 */
const ContentLabPaywall = () => {
  const navigate = useNavigate();

  const { data: run } = useQuery({
    queryKey: ['paywall-demo-run', CONTENT_LAB_DEMO_RUN_ID],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_lab_runs')
        .select('id, created_at, summary')
        .eq('id', CONTENT_LAB_DEMO_RUN_ID)
        .maybeSingle();
      return data;
    },
  });

  const { data: ideas = [], isLoading: ideasLoading } = useQuery<DemoIdea[]>({
    queryKey: ['paywall-demo-ideas', CONTENT_LAB_DEMO_RUN_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_ideas')
        .select('id, idea_number, title, hook, caption, target_platform, is_wildcard')
        .eq('run_id', CONTENT_LAB_DEMO_RUN_ID)
        .order('idea_number')
        .limit(6);
      if (error) throw error;
      return (data ?? []) as DemoIdea[];
    },
  });

  const { data: viralPosts = [], isLoading: postsLoading } = useQuery<DemoPost[]>({
    queryKey: ['paywall-demo-posts', CONTENT_LAB_DEMO_RUN_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_lab_posts')
        .select('id, thumbnail_url, post_url, caption, author_handle, views, likes, comments, engagement_rate, platform, hook_text')
        .eq('run_id', CONTENT_LAB_DEMO_RUN_ID)
        .neq('bucket', 'own')
        .order('views', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as DemoPost[];
    },
  });

  const handleUpgrade = () => navigate('/settings?section=billing');

  return (
    <div className="mx-auto max-w-[1400px] space-y-12 p-6 md:p-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-3 w-3" />
            Content Lab
          </div>
          <h1 className="mt-5 font-display text-4xl leading-tight md:text-5xl">
            Stop guessing what to post.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            See exactly what is working in your niche right now and turn it into 12 ready-to-film
            ideas every single month — built for your brand voice, not generic AI slop.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={handleUpgrade}>
              <PlayCircle className="mr-2 h-4 w-4" /> Start your trial
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/pricing')}>
              See pricing <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> No credit card to preview</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancel anytime</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> White-labelled for your clients</span>
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Live preview</p>
            <h2 className="mt-1 font-display text-2xl">
              AMW Media's {run ? new Date(run.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'latest'} run
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Real data, real ideas. This is the report you would generate for your own niche.
            </p>
          </div>
          <Badge variant="outline" className="hidden md:inline-flex">Read-only demo</Badge>
        </div>

        {/* Viral feed strip */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Viral feed</p>
          {postsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {viralPosts.slice(0, 3).map((p) => (
                <div key={p.id} className="pointer-events-none">
                  <ViralPostCard post={p as unknown as Parameters<typeof ViralPostCard>[0]['post']} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ideas strip — masked behind blur */}
        <div className="relative space-y-3 pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">12 ready-to-film ideas</p>
          {ideasLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-96" />)}
            </div>
          ) : (
            <div className="relative">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ideas.map((idea) => (
                  <Card key={idea.id} className="pointer-events-none flex flex-col overflow-hidden bg-card/40">
                    <div className="bg-gradient-to-b from-muted/40 to-muted/10 px-4 pt-5 pb-3">
                      <IdeaPreviewInstagram
                        hook={idea.hook ?? idea.title}
                        caption={idea.caption ?? null}
                        handle="amwmedia"
                      />
                    </div>
                    <div className="space-y-1.5 border-t border-border/40 p-4">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Idea #{idea.idea_number}
                        {idea.target_platform && <> · <span className="capitalize">{idea.target_platform}</span></>}
                      </p>
                      <h3 className="font-display text-base leading-tight line-clamp-2">{idea.title}</h3>
                      {idea.hook && <p className="text-xs text-muted-foreground line-clamp-2">{idea.hook}</p>}
                      {idea.is_wildcard && <Badge variant="secondary" className="text-[9px]">Wildcard 🚀</Badge>}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Lock overlay — fades the bottom half */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/85 to-transparent backdrop-blur-[2px]" />
              <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8">
                <Button size="lg" onClick={handleUpgrade} className="shadow-xl shadow-primary/20">
                  <Lock className="mr-2 h-4 w-4" /> Unlock all 12 ideas — start trial
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature grid */}
      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Everything included</p>
          <h2 className="mt-1 font-display text-2xl">One add-on. Eight superpowers.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              className="space-y-2 border-border/60 bg-card/40 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="font-display text-base">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">How it works</p>
          <h2 className="mt-1 font-display text-2xl">Discover. Decode. Create.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_STEPS.map((s) => (
            <Card key={s.title} className="space-y-3 border-border/60 bg-card/40 p-6">
              <s.icon className="h-6 w-6 text-primary" />
              <h3 className="font-display text-lg">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center md:p-12">
        <h2 className="font-display text-3xl">Ready to stop guessing?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Add Content Lab to your plan and run your first report this afternoon. Your team will
          have 12 filmable ideas ready by tomorrow morning.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={handleUpgrade}>
            <PlayCircle className="mr-2 h-4 w-4" /> Start your trial
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/pricing')}>
            See pricing
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ContentLabPaywall;
