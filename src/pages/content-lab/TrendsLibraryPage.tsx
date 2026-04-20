import { TrendingUp, Sparkles, Bell } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ContentLabHeader from '@/components/content-lab/ContentLabHeader';
import ContentLabPaywall from '@/components/content-lab/ContentLabPaywall';
import { useContentLabAccess } from '@/hooks/useContentLabAccess';
import usePageMeta from '@/hooks/usePageMeta';

const PREVIEW_FEATURES = [
  {
    title: 'Live momentum signals',
    description: 'See which topics are rising, steady, or fading across your niches in real time.',
  },
  {
    title: 'Cross-run aggregation',
    description: 'Trends detected across every Content Lab run — automatically deduped and ranked.',
  },
  {
    title: 'Recommended actions',
    description: 'Each trend comes with a one-line recommendation so you know exactly what to post next.',
  },
  {
    title: 'Verified sources',
    description: 'Every signal is backed by a verifiable source link, so you can trust what you see.',
  },
];

const TrendsLibraryPage = () => {
  usePageMeta({
    title: 'Trends — Coming Soon',
    description: 'Cross-run trend signals across your niches — coming soon to Content Lab.',
  });
  const { hasAccess, isLoading: accessLoading } = useContentLabAccess();

  if (!accessLoading && !hasAccess) {
    return <AppLayout><ContentLabPaywall /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] space-y-8 p-6 md:p-8">
        <ContentLabHeader
          eyebrow="Content Lab · Trends"
          icon={TrendingUp}
          title="Trends across your niches"
          subtitle="Live trend signals detected across all your runs — with momentum and recommended action."
        />

        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-10 md:p-14">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />

          <div className="relative mx-auto max-w-2xl text-center space-y-5">
            <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              Coming Soon
            </Badge>
            <h2 className="font-display text-3xl md:text-4xl leading-tight">
              We're building something powerful.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              The Trends library is on its way. Soon you'll see live momentum signals across every niche you run — with recommended actions to help you stay ahead.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <Bell className="h-4 w-4 text-primary" />
              You'll be notified the moment it's live.
            </div>
          </div>
        </Card>

        <div>
          <h3 className="font-display text-xl mb-4">What's coming</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {PREVIEW_FEATURES.map((feature) => (
              <Card key={feature.title} className="border-border/60 bg-card/40 p-5">
                <h4 className="font-display text-base mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TrendsLibraryPage;
