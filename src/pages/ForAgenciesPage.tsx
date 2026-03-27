import { Link } from 'react-router-dom';
import { ArrowRight, Users, Palette, Mail, Globe, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import dashboardSnapshot from '@/assets/screenshots/Dashboard_Snapshot.webp';
import googleAdsPlatform from '@/assets/screenshots/Google_ads.webp';

const PAIN_POINTS = [
  { title: 'Hours wasted on manual reports', desc: 'Logging into 10 platforms, copy-pasting data into spreadsheets, formatting slides — every single month, for every client.' },
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

const PLATFORMS = ['Google Ads', 'Meta Ads', 'Google Analytics', 'Google Search Console', 'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Pinterest', 'Google Business Profile'];

const ForAgenciesPage = () => {
  usePageMeta({
    title: 'For Agencies — Automated Client Reports | AMW Reports',
    description: 'Manage multiple clients, automate branded reports, deliver insights automatically. Built by an agency, for agencies. Free plan.',
  });

  return (
    <>
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Marketing Reporting Platform for <span className="text-gradient-purple">Agencies</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Stop spending hours on client reports. AMW Reports automates data collection, report generation, and delivery — so your team can focus on strategy, not spreadsheets. Built by an agency, for agencies.
          </p>
          <Button size="lg" asChild className="mb-12">
            <Link to="/login?view=signup">Start Your Free Agency Account <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>

          {/* Dashboard Screenshot */}
          <img
            src={dashboardSnapshot}
            alt="AMW Reports agency dashboard showing multi-client overview with KPI cards, platform connections, and marketing performance data"
            className="w-full max-w-5xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-white/[0.03] border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">The Agency Reporting Problem</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
                <h3 className="text-sm font-body font-semibold mb-2 text-destructive">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">How AMW Reports Solves It</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOLUTIONS.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-accent/5 border border-accent/20">
                <h3 className="text-sm font-body font-semibold mb-2 text-accent">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-white/[0.03] border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Key Features for Agencies</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {KEY_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
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

      <section className="py-16 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-8">All the Platforms Your Clients Use</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
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
