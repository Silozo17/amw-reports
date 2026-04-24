import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, CheckCircle2, Search, Wand2, Lightbulb, ArrowRight, PlayCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Search, title: 'Real research', body: "Last 30 days of your client's posts, plus local competitors and viral worldwide content." },
  { icon: Lightbulb, title: 'Pattern decode', body: 'AI tags hooks and patterns across every post so the ideas have signal, not noise.' },
  { icon: Wand2, title: '30 ideas per run', body: 'Platform-agnostic ideas with hook, script, caption, CTA and hashtags — ready to film.' },
];

const ContentLabPaywall = () => {
  const navigate = useNavigate();
  const handleUpgrade = () => navigate('/settings?section=billing');
  return (
    <div className="mx-auto max-w-[1100px] space-y-12 p-6 md:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-8 md:p-12">
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-3 w-3" /> Content Lab
          </div>
          <h1 className="mt-5 font-display text-4xl leading-tight md:text-5xl">Stop guessing what to post.</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pick a client. Generate 30 research-backed content ideas in minutes — informed by their own posts, real local competitors, and viral worldwide content.
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
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Free AI edits per idea</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="space-y-3 p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="font-display text-lg">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </Card>
        ))}
      </section>

      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center md:p-12">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 font-display text-3xl">Ready to stop guessing?</h2>
        <Button size="lg" className="mt-6" onClick={handleUpgrade}>
          <PlayCircle className="mr-2 h-4 w-4" /> Start your trial
        </Button>
      </section>
    </div>
  );
};

export default ContentLabPaywall;
