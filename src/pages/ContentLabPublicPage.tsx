import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import IdeaPreviewInstagram from '@/components/content-lab/IdeaPreviewInstagram';
import IdeaPreviewTikTok from '@/components/content-lab/IdeaPreviewTikTok';
import IdeaPreviewFacebook from '@/components/content-lab/IdeaPreviewFacebook';
import { useContentLabPublicDemo } from '@/hooks/useContentLabPublicDemo';
import { AMW_DEMO_SHARE_SLUG } from '@/lib/contentLabDemo';

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

const TIERS = [
  { name: 'Creator', runs: '1 run / month', price: 'Free', highlight: false, perks: ['1 niche', 'Hook & Trend libraries', 'Swipe file', 'Phone-mockup previews'] },
  { name: 'Studio', runs: '3 runs / month', price: 'Most popular', highlight: true, perks: ['Up to 5 niches', 'Pipeline kanban', 'DOCX export', 'Client sharing links'] },
  { name: 'Agency', runs: '10 runs / month', price: 'For agencies', highlight: false, perks: ['Unlimited niches', 'Full multi-client access', 'White-label sharing', 'Priority compute'] },
];

const CREDIT_PACKS = [
  { credits: 5, price: '£15', per: '£3.00 / credit' },
  { credits: 25, price: '£60', per: '£2.40 / credit', badge: 'Best value' },
  { credits: 100, price: '£200', per: '£2.00 / credit', badge: 'Best deal' },
];

const TIMELINE = [
  { t: '0:00', label: 'Run starts', body: 'You hit “New run” — we queue scrape jobs across Instagram, TikTok and Facebook.' },
  { t: '0:30', label: 'Scrape', body: 'Your handle, benchmark creators and competitors are pulled in parallel.' },
  { t: '2:00', label: 'Analyse', body: 'AI extracts hooks, formats, topics, sentiment and posting cadence.' },
  { t: '3:30', label: 'Ideate', body: 'Twelve ideas generated — hooks, scripts, captions, hashtags, filming checklists.' },
  { t: '~5:00', label: 'Ready', body: 'You get an in-app notification (and email if enabled). Open the run.' },
];

const FAQS = [
  { q: 'What is Content Lab?', a: 'An AI-powered content engine. It scrapes the last 60 days of viral content in your niche, extracts the patterns that drove engagement, and turns them into 12 ready-to-film ideas every month — with hooks, scripts, filming checklists and phone-mockup previews.' },
  { q: 'What platforms does it scrape?', a: 'Instagram, TikTok and Facebook today. Threads, LinkedIn and YouTube are on the roadmap. The Hook and Trend libraries pull across every platform we support.' },
  { q: 'Whose content does it look at?', a: 'Three pools per run: your own handle, a curated set of benchmark creators in your niche, and the competitors you specify. You stay in control of who is tracked.' },
  { q: 'Are the ideas unique to me?', a: 'Yes. Every idea is generated against your brand brief — tone of voice, do-not-use list, content styles, target audience and own context. No two runs (or two orgs) get the same output.' },
  { q: 'Can I share runs with clients?', a: 'Yes. Generate a branded share link, comment on ideas together, or export the full run to DOCX. White-label is included on Agency.' },
  { q: 'What does a credit cost?', a: 'One credit = one extra run beyond your monthly allowance. Packs start at £15 for 5 credits (£3 each) and scale to £200 for 100 credits (£2 each).' },
  { q: 'Do credits expire?', a: 'Never. Buy a pack, use it whenever — they sit in your balance until you spend them.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your billing settings in two clicks. You keep access until the end of the period you’ve already paid for.' },
];

const ContentLabPublicPage = () => {
  usePageMeta({
    title: 'Content Lab — AI Content Engine for Creators & Agencies',
    description: 'Scrape what’s working in your niche, decode the patterns, and ship 12 ready-to-film ideas every month. Hooks, scripts, filming checklists — built for creators, freelancers and agencies.',
  });

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
          <p className="font-accent text-xl text-primary mb-2">AI Content Engine</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-5 leading-[1.05]">
            Stop Guessing What to Post.<br />
            Decode What’s Working — <span className="text-gradient-purple">Then Make It Yours.</span>
          </h1>
          <p className="text-lg text-amw-offwhite/65 font-body max-w-2xl mx-auto mb-8">
            Content Lab scrapes the last 60 days of viral content in any niche, extracts the patterns behind it,
            and turns them into 12 ready-to-film ideas every month — with hooks, scripts, filming checklists
            and phone-mockup previews.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login?view=signup">Start Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/40">
              <a href="#how-it-works">See how it works ↓</a>
            </Button>
          </div>
          <p className="text-xs text-amw-offwhite/50 font-body mt-5">Includes a free run on the Creator plan. No credit card required.</p>
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

      {/* 7. Pricing */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="font-accent text-lg text-primary mb-2">Pricing</p>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start free. <span className="text-gradient-purple">Scale when you’re ready.</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-7 flex flex-col ${
                  tier.highlight ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-sidebar-border/50 bg-sidebar-accent/15'
                }`}
              >
                {tier.highlight && (
                  <span className="self-start mb-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-body font-semibold">Most popular</span>
                )}
                <h3 className="text-2xl font-heading uppercase mb-1">{tier.name}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body mb-1">{tier.runs}</p>
                <p className="text-sm font-body text-primary mb-5">{tier.price}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm font-body text-amw-offwhite/80">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full" variant={tier.highlight ? 'default' : 'outline'}>
                  <Link to="/login?view=signup">Start trial</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-sidebar-border/50 bg-sidebar-accent/10 p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <p className="font-accent text-sm text-primary mb-1">Need more runs?</p>
                <h3 className="text-2xl font-heading uppercase">Top up with credits — they never expire.</h3>
              </div>
              <Link to="/pricing" className="text-sm font-body text-primary hover:underline">See full pricing →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CREDIT_PACKS.map((pack) => (
                <div key={pack.credits} className="rounded-xl border border-sidebar-border/50 bg-amw-black/40 p-5">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-2xl font-heading">{pack.credits} credits</p>
                    {pack.badge && <span className="text-[10px] font-body text-primary uppercase tracking-wider">{pack.badge}</span>}
                  </div>
                  <p className="text-3xl font-heading text-amw-offwhite mb-1">{pack.price}</p>
                  <p className="text-xs font-body text-amw-offwhite/60">{pack.per}</p>
                </div>
              ))}
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
              <Link to="/login?view=signup">Start Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/40">
              <Link to="/pricing">See full pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContentLabPublicPage;
