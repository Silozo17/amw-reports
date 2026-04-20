import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Search,
  Brain,
  Sparkles,
  Flame,
  TrendingUp,
  Kanban,
  Heart,
  Share2,
  LineChart,
  Lightbulb,
  Clock3,
  Users,
  Briefcase,
  Building2,
  Check,
  Rocket,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import IdeaPreviewInstagram from '@/components/content-lab/IdeaPreviewInstagram';
import IdeaPreviewTikTok from '@/components/content-lab/IdeaPreviewTikTok';
import IdeaPreviewFacebook from '@/components/content-lab/IdeaPreviewFacebook';
import { useContentLabPublicDemo } from '@/hooks/useContentLabPublicDemo';
import { AMW_DEMO_SHARE_SLUG } from '@/lib/contentLabDemo';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  CONTENT_LAB_TIER_LIST,
  CONTENT_LAB_CREDIT_PACK_LIST,
  type ContentLabTierKey,
} from '@/lib/contentLabPricing';

const SAMPLE_IDEA = {
  hook: '3 things I wish I knew before launching my agency',
  handle: 'yourbrand',
  caption: 'Save this before you start ↓',
};

const FEATURES = [
  { icon: Search, title: 'Viral Feed', body: 'Your own posts, benchmark creators and competitors — last 60 days, ranked by engagement.' },
  { icon: Brain, title: 'Pattern Insights', body: 'AI extracts winning formats, hot topics, sentiment and posting cadence.' },
  { icon: Sparkles, title: '12 Ready-to-Film Ideas', body: 'Every run delivers a dozen complete ideas, including bold wildcard concepts 🚀.' },
  { icon: Flame, title: 'Global Hook Library', body: 'Every hook from every run across the platform — ranked by real-world engagement.' },
  { icon: TrendingUp, title: 'Trend Library', body: 'Live momentum signals plus what to do about them — verified with sources.' },
  { icon: Kanban, title: 'Pipeline Kanban', body: 'Move ideas from script → film → edit → posted, with status at a glance.' },
  { icon: Heart, title: 'Swipe File', body: 'Save the best ideas across all your runs and clients into one library.' },
  { icon: Share2, title: 'Client Sharing', body: 'Share runs by link, export to DOCX, collect comments — all white-labelled.' },
];

const STEPS = [
  { num: '01', icon: Search, title: 'Discover', body: 'We pull your own content, benchmark creators in your niche, and competitors you choose. The last 60 days, ranked by what actually performed.' },
  { num: '02', icon: Brain, title: 'Decode', body: 'AI analyses every post — extracting hooks, formats, hot topics, content mechanisms and posting cadence. The patterns behind the wins, not just the wins.' },
  { num: '03', icon: Sparkles, title: 'Create', body: '12 ready-to-film ideas every run. Hook variants, full scripts, captions, CTAs, hashtags, filming checklists — and a phone-mockup preview of each one.' },
];

const PROBLEMS = [
  { title: 'Hours scrolling for inspiration', body: 'Your competitors’ feeds are a black hole. Two hours later you’re no closer to a content plan.' },
  { title: 'Posting and praying', body: 'You hit publish and hope. No idea what hook will land, what format works, what topic to chase.' },
  { title: 'Burning out on the treadmill', body: 'Daily content is brutal. Without a system you eventually run dry — or post mediocre work to fill the gap.' },
];

const AUDIENCES = [
  { icon: Users, title: 'Solo Creators', body: 'Ship consistent, on-brand content without burning out. One run a month becomes 12 ready ideas.' },
  { icon: Briefcase, title: 'Freelancers', body: 'Sell content strategy as a service. Run it for clients, share branded links, charge a premium.' },
  { icon: Building2, title: 'Agencies', body: 'Scale content production across every client. Multi-tenant, white-labelled, kanban-tracked.' },
];

// Pricing comes from CONTENT_LAB_TIER_LIST / CONTENT_LAB_CREDIT_PACK_LIST in contentLabPricing.ts.

const TIER_PERKS: Record<ContentLabTierKey, string[]> = {
  starter: ['1 niche', 'Hook & Trend libraries', 'Swipe file', 'Phone-mockup previews'],
  growth:  ['Up to 5 niches', 'Pipeline kanban', 'DOCX export', 'Client sharing links'],
  scale:   ['Unlimited niches', 'Full multi-client access', 'White-label sharing', 'Priority compute'],
};

const TIMELINE = [
  { t: '0:00', label: 'Run starts', body: 'You hit “New run” — we queue scrape jobs across Instagram, TikTok and Facebook.' },
  { t: '0:30', label: 'Scrape', body: 'Your handle, benchmark creators and competitors are pulled in parallel.' },
  { t: '2:00', label: 'Analyse', body: 'AI extracts hooks, formats, topics, sentiment and posting cadence.' },
  { t: '3:30', label: 'Ideate', body: 'Twelve ideas generated — hooks, scripts, captions, hashtags, filming checklists.' },
  { t: '~5:00', label: 'Ready', body: 'You get an in-app notification (and email if enabled). Open the run.' },
];

const FAQS = [
  { q: 'What is Content Lab?', a: 'An AI-powered content engine. It scrapes the last 60 days of viral content in your niche, extracts the patterns that drove engagement, and turns them into 12 ready-to-film ideas every month — with hooks, scripts, filming checklists and phone-mockup previews.' },
  { q: 'Is Content Lab included with my AMW Reports plan?', a: 'No. Content Lab is a separate paid add-on with its own pricing — Starter (£49/mo · 3 runs), Growth (£149/mo · 5 runs), or Scale (£299/mo · 20 runs). It is not bundled with any AMW Reports plan.' },
  { q: 'Can I try it for free?', a: 'No — Content Lab is 100% paid, no free trial. Start on the Starter tier (£49/mo) to evaluate, then cancel anytime in two clicks if it is not for you.' },
  { q: 'What platforms does it scrape?', a: 'Instagram, TikTok and Facebook today. Threads, LinkedIn and YouTube are on the roadmap. The Hook and Trend libraries pull across every platform we support.' },
  { q: 'Whose content does it look at?', a: 'Three pools per run: your own handle, a curated set of benchmark creators in your niche, and the competitors you specify. You stay in control of who is tracked.' },
  { q: 'Are the ideas unique to me?', a: 'Yes. Every idea is generated against your brand brief — tone of voice, do-not-use list, content styles, target audience and own context. No two runs (or two orgs) get the same output.' },
  { q: 'Can I share runs with clients?', a: 'Yes. Generate a branded share link, comment on ideas together, or export the full run to DOCX.' },
  { q: 'What does a credit buy?', a: '1 credit = 1 idea regeneration · OR · 1 remix (platform swap, tone shift, hook rewrite) · OR · 1 manual pool refresh. Packs start at £25 for 5 credits and scale to £149 for 100 credits (saving 70% per credit).' },
  { q: 'Do credits expire?', a: 'Never. Buy a pack, use it whenever — they sit in your balance until you spend them.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your billing settings in two clicks. You keep access until the end of the period you have already paid for.' },
];

const ContentLabPublicPage = () => {
  usePageMeta({
    title: 'Content Lab — AI Content Engine for Creators & Agencies',
    description: 'Scrape what is working in your niche, decode the patterns, and ship 12 ready-to-film ideas every month. Hooks, scripts, filming checklists — paid add-on from £49/mo.',
  });

  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingTier, setLoadingTier] = useState<ContentLabTierKey | null>(null);

  const handleSubscribe = async (tier: ContentLabTierKey) => {
    if (!user) {
      navigate('/login?view=signup&redirect=/content-lab-feature%23pricing');
      return;
    }
    setLoadingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-content-lab-subscription-checkout', {
        body: { tier },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No checkout URL returned');
      window.open(data.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <>
      {/* 1. Hero */}
      <section className="relative py-20 lg:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={28} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={18} color="blue" className="absolute bottom-[18%] left-[6%]" animated={false} />
          <StarDecoration size={14} color="purple" className="absolute top-[30%] left-[12%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4 relative">
          <p className="font-accent text-xl text-primary mb-2">AI Content Engine · Paid add-on</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-5 leading-[1.05]">
            Stop Guessing What to Post.<br />
            Decode What's Working — <span className="text-gradient-purple">Then Make It Yours.</span>
          </h1>
          <p className="text-lg text-amw-offwhite/65 font-body max-w-2xl mx-auto mb-8">
            Content Lab scrapes the last 60 days of viral content in any niche, extracts the patterns behind it,
            and turns them into 12 ready-to-film ideas every month — with hooks, scripts, filming checklists
            and phone-mockup previews.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <a href="#pricing">See pricing — from £49/mo <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/40">
              <a href="#how-it-works">See how it works ↓</a>
            </Button>
          </div>
          <p className="text-xs text-amw-offwhite/50 font-body mt-5">Sold separately from AMW Reports plans. No free trial — cancel anytime.</p>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* 2. Problem */}
      <section className="py-20 lg:py-24 section-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">The content treadmill is broken</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">If posting consistently feels impossible — you’re not alone.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-sidebar-border/50 bg-sidebar-accent/20 p-6">
                <h3 className="text-lg font-heading uppercase mb-2 text-amw-offwhite">{p.title}</h3>
                <p className="text-sm text-amw-offwhite/65 font-body leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section id="how-it-works" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">How it works</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Discover → Decode → <span className="text-gradient-purple">Create</span></h2>
            <p className="text-amw-offwhite/60 font-body mt-4">A typical run takes 3–5 minutes — and gives you a month of content.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(({ num, icon: Icon, title, body }) => (
              <div key={num} className="rounded-2xl border border-sidebar-border/50 bg-sidebar-accent/15 p-7 relative">
                <div className="absolute -top-3 -left-3 bg-primary/15 border border-primary/30 rounded-lg px-2.5 py-1 text-xs font-mono text-primary">{num}</div>
                <Icon className="h-9 w-9 text-primary mb-4" />
                <h3 className="text-xl font-heading uppercase mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/65 font-body leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* 4. Inside every run — features */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">Inside every run</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Eight tools. <span className="text-gradient-purple">One workflow.</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-sidebar-border/50 bg-amw-black/40 p-5 hover:border-primary/40 transition-colors">
                <Icon className="h-7 w-7 text-primary mb-3" />
                <h3 className="text-base font-heading uppercase mb-1.5 text-amw-offwhite">{title}</h3>
                <p className="text-sm text-amw-offwhite/65 font-body leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. What you get per idea */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-lg text-primary mb-2">Every idea, ready to film</p>
              <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-5">Not just a title. <span className="text-gradient-purple">A complete brief.</span></h2>
              <p className="text-amw-offwhite/65 font-body mb-6">Each of the 12 ideas comes with a full plan. Open it, hand it to your editor, or shoot it yourself today.</p>
              <ul className="space-y-3">
                {[
                  'Multiple hook variants — pick the angle that fits',
                  '30-second script with timing notes',
                  'Caption + CTA + hashtags ready to paste',
                  'Why-it-works analysis tied to a real viral post',
                  'Filming checklist (props, settings, b-roll)',
                  'Phone-mockup preview of how it’ll look posted',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm font-body text-amw-offwhite/80">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
                <div className="relative">
                  <IdeaPreviewInstagram hook={SAMPLE_IDEA.hook} handle={SAMPLE_IDEA.handle} caption={SAMPLE_IDEA.caption} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* 5b. See a real run — live AMW demo */}
      <ContentLabLiveDemoSection />

      <div className="gradient-divider w-full" />

      {/* 6. Audiences */}
      <section className="py-20 lg:py-24 section-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">Built for</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Whoever ships the content.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-sidebar-border/50 bg-sidebar-accent/20 p-7 text-center">
                <Icon className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-heading uppercase mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/65 font-body leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Pricing — paid add-on */}
      <section id="pricing" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">Pricing · Paid add-on</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Pick your plan. <span className="text-gradient-purple">No free trial.</span></h2>
            <p className="text-amw-offwhite/60 font-body mt-4">Sold separately from AMW Reports. Cancel anytime in two clicks.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {CONTENT_LAB_TIER_LIST.map((tier) => (
              <div
                key={tier.key}
                className={`rounded-2xl border p-7 flex flex-col ${
                  tier.highlight ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-sidebar-border/50 bg-sidebar-accent/15'
                }`}
              >
                {tier.highlight && (
                  <span className="self-start mb-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-body font-semibold">Most popular</span>
                )}
                <h3 className="text-2xl font-heading uppercase mb-1">{tier.name}</h3>
                <p className="text-4xl font-heading mb-1">£{tier.priceMonthly}<span className="text-base text-amw-offwhite/55 font-body"> /mo</span></p>
                <p className="text-sm text-amw-offwhite/60 font-body mb-5">{tier.runsPerMonth} run{tier.runsPerMonth === 1 ? '' : 's'} / month</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {TIER_PERKS[tier.key].map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm font-body text-amw-offwhite/80">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={tier.highlight ? 'default' : 'outline'}
                  disabled={loadingTier !== null}
                  onClick={() => handleSubscribe(tier.key)}
                >
                  {loadingTier === tier.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Subscribe
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-sidebar-border/50 bg-sidebar-accent/10 p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
              <div>
                <p className="font-accent text-sm text-primary mb-1">Top up with credit packs</p>
                <h3 className="text-2xl font-heading uppercase">1 credit = 1 regeneration · 1 remix · 1 pool refresh</h3>
              </div>
            </div>
            <p className="text-sm text-amw-offwhite/55 font-body mb-6">Credits never expire. One-off purchase, no subscription.</p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {CONTENT_LAB_CREDIT_PACK_LIST.map((pack) => {
                const isHighlighted = pack.badge === 'Best value';
                return (
                  <div
                    key={pack.key}
                    className={`relative rounded-xl border bg-amw-black/40 p-5 ${
                      isHighlighted ? 'border-primary/60 ring-1 ring-primary/30' : 'border-sidebar-border/50'
                    }`}
                  >
                    {pack.badge && (
                      <span className={`absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider ${
                        isHighlighted ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-amw-offwhite/80'
                      }`}>
                        {pack.badge}
                      </span>
                    )}
                    <p className="text-xl font-heading text-amw-offwhite mb-1">{pack.credits} credits</p>
                    <p className="text-2xl font-heading mb-1">£{pack.price}</p>
                    <p className="text-xs font-body text-amw-offwhite/60">£{(pack.price / pack.credits).toFixed(2)} / credit</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* 8. How runs work — timeline */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="font-accent text-lg text-primary mb-2">Under the hood</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">From “new run” to ready ideas in <span className="text-gradient-purple">~5 minutes.</span></h2>
          </div>
          <div className="relative space-y-5">
            {TIMELINE.map((step) => (
              <div key={step.t} className="flex gap-5 items-start">
                <div className="shrink-0 w-20 text-right">
                  <span className="font-mono text-sm text-primary">{step.t}</span>
                </div>
                <div className="shrink-0 w-3 h-3 rounded-full bg-primary mt-1.5" />
                <div className="flex-1 rounded-xl border border-sidebar-border/50 bg-amw-black/40 p-4">
                  <h4 className="text-base font-heading uppercase mb-1 text-amw-offwhite flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" /> {step.label}
                  </h4>
                  <p className="text-sm font-body text-amw-offwhite/65">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="font-accent text-lg text-primary mb-2">FAQ</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Questions, answered.</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="border-sidebar-border/40">
                <AccordionTrigger className="text-left font-body text-amw-offwhite hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm font-body text-amw-offwhite/65 leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* 10. SEO long-form */}
      <section className="py-20 lg:py-24 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center mb-4">
            <p className="font-accent text-lg text-primary mb-2">Why it works</p>
            <h2 className="text-2xl lg:text-4xl font-heading uppercase">How AI Content Research Saves Marketers 20+ Hours a Month</h2>
          </div>
          <div className="space-y-5 text-sm font-body text-amw-offwhite/70 leading-relaxed">
            <p>
              The hardest part of social media isn’t filming or editing — it’s deciding what to make. Marketers spend an
              estimated 8–12 hours a week scrolling competitor feeds, screenshotting hooks and trying to reverse-engineer
              what worked. Content Lab collapses that research loop into a single five-minute run.
            </p>
            <p>
              Instead of guessing, you start every month with twelve fully-briefed ideas grounded in real, recent
              performance data. Each idea is tied back to a specific viral post — so you understand <em>why</em> it’s
              expected to work, not just what to film. Hooks come with mechanism tags (curiosity gap, social proof,
              contrarian, stat shock) so your team builds an intuition over time.
            </p>
            <p>
              For agencies and freelancers, this is the difference between charging for output and charging for strategy.
              You can hand a branded share link to a client, walk them through the trends report, and turn approved ideas
              into a kanban-tracked production pipeline — all in the same tool. No more spreadsheet handoffs, no more
              “what should we post next month?” emails.
            </p>
            <p>
              And because the Hook and Trend libraries grow with every run across the platform, the system gets sharper
              the longer you use it. You’re not just running a content calendar — you’re building a compounding library
              of what works in your space.
            </p>
          </div>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="py-24 lg:py-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={32} color="purple" className="absolute top-[20%] left-[10%]" />
          <StarDecoration size={20} color="blue" className="absolute bottom-[25%] right-[12%]" animated={false} />
        </div>
        <div className="max-w-3xl mx-auto px-4 relative">
          <Rocket className="h-12 w-12 text-primary mx-auto mb-5" />
          <h2 className="text-4xl lg:text-6xl font-heading uppercase mb-4 leading-[1.05]">
            Stop scrolling.<br />
            <span className="text-gradient-purple">Start shipping.</span>
          </h2>
          <p className="text-lg text-amw-offwhite/65 font-body mb-8 max-w-xl mx-auto">
            Join the creators, freelancers and agencies who plan a month of content in five minutes — not a weekend.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <a href="#pricing">See pricing — from £49/mo <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/40">
              <Link to="/pricing">AMW Reports plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

const PIPELINE_COLUMNS = [
  { key: 'scripted', label: 'Scripted', tone: 'border-primary/40 bg-primary/5' },
  { key: 'filming', label: 'Filming', tone: 'border-amw-orange/40 bg-amw-orange/5' },
  { key: 'edit', label: 'Edit', tone: 'border-secondary/40 bg-secondary/5' },
  { key: 'posted', label: 'Posted', tone: 'border-accent/40 bg-accent/5' },
] as const;

const renderIdeaPreview = (idea: { hook: string | null; caption: string | null; target_platform: string | null }, handle: string) => {
  const hook = idea.hook ?? 'Decode what works in your niche.';
  const caption = idea.caption ?? '';
  const platform = (idea.target_platform ?? 'instagram').toLowerCase();
  if (platform.includes('tiktok')) return <IdeaPreviewTikTok hook={hook} handle={handle} caption={caption} />;
  if (platform.includes('facebook')) return <IdeaPreviewFacebook hook={hook} handle={handle} caption={caption} />;
  return <IdeaPreviewInstagram hook={hook} handle={handle} caption={caption} />;
};

const ContentLabLiveDemoSection = () => {
  const { data, isLoading } = useContentLabPublicDemo();

  // Hide silently on error/empty so the rest of the page stays clean.
  if (!isLoading && (!data || !data.ideas?.length)) return null;

  const ideas = data?.ideas ?? [];
  const topPosts = (data?.top_posts ?? []).slice(0, 8);
  const handle = (data?.client_name ?? 'amwmedia').toLowerCase().replace(/\s+/g, '');
  const previewIdeas = ideas.slice(0, 6);
  const pipelineIdeas = ideas.slice(0, 8);
  const hookIdeas = ideas.filter((i) => i.hook).slice(0, 8);

  return (
    <section id="live-demo" className="py-20 lg:py-28 section-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <p className="font-accent text-lg text-primary mb-2">See a real run</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">
            Real data. Real ideas. <span className="text-gradient-purple">From AMW Media.</span>
          </h2>
          <p className="text-amw-offwhite/60 font-body mt-3">
            Below is a live read-only sample from AMW Media's most recent Content Lab run — straight from the platform.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full max-w-[260px] mx-auto rounded-2xl" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="ideas" className="w-full">
            <TabsList className="mx-auto flex w-fit max-w-full overflow-x-auto bg-sidebar-accent/30 border border-sidebar-border/50 mb-8">
              <TabsTrigger value="ideas">Ideas</TabsTrigger>
              <TabsTrigger value="viral">Viral Feed</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="hooks">Hook Library</TabsTrigger>
            </TabsList>

            {/* Ideas — phone mockups */}
            <TabsContent value="ideas">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {previewIdeas.map((idea) => (
                  <div key={idea.id} className="flex flex-col items-center gap-3">
                    {renderIdeaPreview(idea, handle)}
                    <div className="text-center max-w-[260px]">
                      <p className="text-sm font-body font-semibold text-amw-offwhite line-clamp-2">{idea.title}</p>
                      {idea.is_wildcard && <Badge variant="secondary" className="mt-2 text-[10px]">Wildcard 🚀</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Viral Feed — top performing benchmark posts */}
            <TabsContent value="viral">
              {topPosts.length === 0 ? (
                <p className="text-center text-amw-offwhite/60 font-body">No reference posts available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {topPosts.map((post, i) => (
                    <a
                      key={`${post.author_handle}-${i}`}
                      href={post.post_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-[9/16] rounded-xl overflow-hidden bg-sidebar-accent/30 border border-sidebar-border/50 relative hover:border-primary/50 transition-colors"
                    >
                      {post.thumbnail_url ? (
                        <img
                          src={post.thumbnail_url}
                          alt={`Post by @${post.author_handle}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                        />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 text-[10px] font-body text-white">
                        <p className="font-semibold truncate">@{post.author_handle}</p>
                        <p className="opacity-80">{post.views.toLocaleString()} views</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Pipeline — static read-only kanban */}
            <TabsContent value="pipeline">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {PIPELINE_COLUMNS.map((col, colIdx) => {
                  const colItems = pipelineIdeas.filter((_, i) => i % 4 === colIdx);
                  return (
                    <div key={col.key} className={`rounded-xl border ${col.tone} p-4 min-h-[280px]`}>
                      <h3 className="text-xs font-body font-semibold uppercase tracking-wider text-amw-offwhite/80 mb-3">{col.label}</h3>
                      <div className="space-y-2">
                        {colItems.map((idea) => (
                          <div key={idea.id} className="rounded-lg bg-amw-black/50 border border-sidebar-border/50 p-3">
                            <p className="text-xs font-body text-amw-offwhite line-clamp-3">{idea.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs font-body text-amw-offwhite/50 text-center mt-4">Read-only preview. In-app, drag cards across columns to track production.</p>
            </TabsContent>

            {/* Hook Library — pulled from idea hooks */}
            <TabsContent value="hooks">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hookIdeas.map((idea, i) => (
                  <div key={idea.id} className="rounded-xl border border-sidebar-border/50 bg-amw-black/40 p-4 flex items-start gap-3">
                    <span className="font-mono text-xs text-primary mt-0.5 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-amw-offwhite leading-snug">{idea.hook}</p>
                      <p className="text-[11px] font-body text-amw-offwhite/50 mt-1.5">From idea: {idea.title}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs font-body text-amw-offwhite/50 text-center mt-4">In-app, the Hook Library ranks every hook from every run by real engagement.</p>
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-10 text-center">
          <a
            href={`/share/content-lab/${AMW_DEMO_SHARE_SLUG}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-body text-primary hover:underline"
          >
            Open the full AMW Media run →
          </a>
        </div>
      </div>
    </section>
  );
};

export default ContentLabPublicPage;
