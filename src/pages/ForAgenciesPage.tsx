import { Link } from 'react-router-dom';
import { ArrowRight, Users, Palette, Mail, Globe, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import dashboardSnapshot from '@/assets/screenshots/Dashboard_Snapshot.webp';
import googleAdsPlatform from '@/assets/screenshots/Google_ads.webp';

const PAIN_POINTS = [
  { title: 'Hours wasted on manual reports', desc: 'Logging into 14 platforms, copy-pasting data into spreadsheets, formatting slides — every single month, for every client.' },
  { title: 'Inconsistent formatting', desc: 'Different team members create reports differently. No unified brand presence across client deliverables.' },
  { title: 'Manual data pulling is error-prone', desc: 'Wrong date ranges, missed metrics, outdated screenshots — manual reporting introduces mistakes that erode client trust.' },
];

const SOLUTIONS = [
  { title: 'Automated data collection', desc: 'AMW Reports pulls data from all connected platforms automatically — daily on paid plans, monthly on free.' },
  { title: 'Branded, consistent reports', desc: 'Every report uses your agency branding. Same format, same quality, every time. Powered by your brand guidelines.' },
  { title: 'Zero-touch delivery', desc: 'Reports are generated and emailed to clients automatically. You review only when you want to.' },
];

const KEY_FEATURES = [
  { icon: Users, title: 'Multi-Client Management', desc: 'Manage all your agency clients from a single dashboard. Add, configure, and monitor each one independently.' },
  { icon: Palette, title: 'Full White-Label', desc: 'Your logo, colours, fonts, and custom domain. Clients see your brand — not ours.' },
  { icon: Mail, title: 'Automated Email Delivery', desc: 'Reports delivered straight to client inboxes on your schedule.' },
  { icon: BarChart3, title: 'Per-Client Dashboards', desc: 'Each client gets their own configurable dashboard with only the platforms and metrics that matter to them.' },
  { icon: Globe, title: 'Custom Domain', desc: 'Serve the client portal from your own domain for a premium, fully branded experience.' },
];

const PLATFORMS = ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'Google Analytics', 'Google Search Console', 'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'TikTok Ads', 'Pinterest', 'Google Business Profile', 'Threads'];

const ForAgenciesPage = () => {
  usePageMeta({
    title: 'For Agencies — Automated Client Reports | AMW Reports',
    description: 'Manage multiple clients, automate branded reports, deliver insights automatically. Built by an agency, for agencies. Free plan.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={28} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="blue" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">For Agencies</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Marketing Reporting Platform for <span className="text-gradient-purple">Agencies</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Stop spending hours on client reports. AMW Reports automates data collection, report generation, and delivery — so your team can focus on strategy, not spreadsheets. Built by an agency, for agencies.
          </p>
          <Button size="lg" asChild className="mb-12">
            <Link to="/login?view=signup">Start Your Free Agency Account <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>

          <img
            src={dashboardSnapshot}
            alt="AMW Reports agency dashboard showing multi-client overview with KPI cards, platform connections, and marketing performance data"
            className="w-full max-w-5xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">The problem</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">The Agency Reporting Problem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-colors">
                <h3 className="text-sm font-body font-semibold mb-2 text-destructive">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">The solution</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">How AMW Reports Solves It</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOLUTIONS.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-accent/5 border border-accent/20 hover:border-accent/40 transition-colors">
                <h3 className="text-sm font-body font-semibold mb-2 text-accent">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="orange" className="absolute top-[8%] right-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">What you get</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Key Features for Agencies</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {KEY_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-body font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
                </div>
              ))}
            </div>
            <img
              src={googleAdsPlatform}
              alt="Google Ads reporting card showing ad spend, impressions, clicks, CTR, conversions, and ROAS metrics"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Integrations</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-8">All the Platforms Your Clients Use</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Why Agencies Choose AMW Reports for Client Reporting</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Marketing agencies face a unique reporting challenge: every client uses a different combination of platforms, every stakeholder wants different metrics highlighted, and every report needs to look professionally branded. Traditional approaches — spreadsheets, manual data exports, slide decks — do not scale beyond a handful of clients without dedicating significant team time to reporting each month.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            AMW Reports was built specifically for this multi-client reality. Each client gets their own configurable dashboard with only the platforms and metrics relevant to them. One client might need Google Ads spend data alongside Instagram engagement; another might focus on SEO performance from Google Search Console and Google Analytics. The platform handles all fourteen supported platforms across paid advertising, organic social media, SEO, and web analytics — so no matter what services you offer, the reporting is covered.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The Agency plan includes full white-label branding, which means your clients see your agency identity on every report, email, and portal page. Combined with custom domain support, unlimited team members, daily data syncing, and twenty-four months of historical data imports, the platform provides everything a growing agency needs to deliver automated client reports at scale. There are no per-seat fees — your entire team accesses the platform for one flat monthly price.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            AMW Reports also includes AI-powered marketing analysis that generates plain-English insights from your client data, a client portal with shareable links for transparent reporting, and automated email delivery that sends branded reports to clients on schedule. For agencies that want to reduce manual reporting work, improve report quality, and scale their client base without proportionally scaling their operations team, AMW Reports provides the automated agency reporting software to make that possible.
          </p>
        </div>
      </section>

      {/* ── SEO: FAQ ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Agency Reporting FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'How many clients can I manage with AMW Reports?', a: 'The Agency plan includes 5 clients with the option to add more at £9.99 per month each. There is no hard upper limit — agencies can scale to dozens of clients.' },
              { q: 'Can different team members access the platform?', a: 'Yes. Both the Freelance and Agency plans support unlimited team members at no extra cost. You can invite colleagues and assign roles.' },
              { q: 'How does AMW Reports compare to AgencyAnalytics or DashThis?', a: 'Unlike tools that charge per dashboard or per user, AMW Reports offers a flat monthly price. Full white-label branding, automated PDF generation, and a client portal are all included — not sold as add-ons.' },
              { q: 'Can I report on both organic and paid channels in one report?', a: 'Absolutely. AMW Reports consolidates organic social media, paid advertising, SEO, and web analytics data into a single branded report for each client.' },
            ].map(({ q, a }) => (
              <details key={q} className="border border-sidebar-border/40 rounded-xl overflow-hidden group">
                <summary className="p-4 text-sm font-body font-semibold text-amw-offwhite/90 cursor-pointer hover:bg-sidebar-accent/20 transition-colors list-none flex items-center justify-between">
                  {q}
                  <span className="text-amw-offwhite/40 group-open:rotate-180 transition-transform text-lg leading-none">▾</span>
                </summary>
                <div className="px-4 pb-4 text-sm font-body text-amw-offwhite/60 leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Your Free Agency Account</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Upgrade to Agency for full white-label branding.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default ForAgenciesPage;
