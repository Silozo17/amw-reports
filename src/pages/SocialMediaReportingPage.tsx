import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';

const PLATFORMS = [
  { name: 'Facebook', metrics: ['Page Likes', 'Followers', 'Reach', 'Impressions', 'Engagement', 'Reactions', 'Comments', 'Shares', 'Video Views', 'Posts Published'] },
  { name: 'Instagram', metrics: ['Followers', 'Reach', 'Impressions', 'Engagement', 'Likes', 'Comments', 'Saves', 'Shares', 'Profile Visits', 'Reels', 'Carousels'] },
  { name: 'LinkedIn', metrics: ['Followers', 'Follower Growth', 'Impressions', 'Engagement', 'Clicks', 'Reactions', 'Comments', 'Shares', 'Posts Published'] },
  { name: 'TikTok', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Video Views'] },
  { name: 'YouTube', metrics: ['Subscribers', 'Views', 'Watch Time', 'Avg. View Duration', 'Videos Published', 'Top Videos'] },
  { name: 'Pinterest', metrics: ['Impressions', 'Engagements', 'Pin Clicks', 'Saves', 'Outbound Clicks', 'Total Audience'] },
];

const METRICS_GRID = ['Followers & Growth', 'Engagement Rate', 'Reach & Impressions', 'Video Views & Watch Time', 'Top-Performing Posts', 'Audience Demographics', 'Comments & Shares', 'Profile Visits', 'Content Type Breakdown', 'Month-over-Month Trends'];

const AUDIENCES = [
  { title: 'Social Media Managers', desc: 'Save hours on monthly client reports. Pull all social data into one branded PDF automatically.', href: '/for-agencies' },
  { title: 'Agencies', desc: 'Manage multiple clients from one dashboard with white-label branding and automated delivery.', href: '/for-agencies' },
  { title: 'Freelancers', desc: 'Impress clients with professional reports that make you look like a full agency.', href: '/for-freelancers' },
];

const FAQS = [
  { q: 'What social media platforms does AMW Reports support?', a: 'We support Facebook Pages, Instagram, LinkedIn Company Pages, TikTok (ads), YouTube, and Pinterest — covering all major social networks your clients use.' },
  { q: 'Can I track organic and paid social media in the same report?', a: 'Yes. AMW Reports pulls both organic social metrics (followers, engagement, reach) and paid ad metrics (spend, ROAS, conversions) into a single unified report for each client.' },
  { q: 'How often is social media data synced?', a: 'Agency plans sync daily. Freelance plans sync weekly (every Monday). The free Creator plan syncs monthly on the 4th.' },
  { q: 'Can I choose which social media metrics appear in the report?', a: 'Absolutely. Each client has a configurable dashboard where you can enable or disable specific metrics and platforms to show only what matters.' },
  { q: 'Do I need to give AMW Reports my social media passwords?', a: 'No. We use official OAuth connections (the same secure method used by Meta, Google, LinkedIn, etc.) so we never see or store your passwords.' },
];

const SocialMediaReportingPage = () => {
  usePageMeta({
    title: 'Social Media Reporting Tool — Automated Reports',
    description: 'Track Facebook, Instagram, LinkedIn, TikTok & YouTube in one dashboard. Generate branded social media reports. Free plan.',
  });

  return (
    <>
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Social Media Reporting Tool for <span className="text-gradient-purple">Agencies & Freelancers</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Consolidate Facebook, Instagram, LinkedIn, TikTok, YouTube, and Pinterest data into one clean, client-ready report — automatically. Free plan available.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section className="py-16 border-t border-sidebar-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">All Your Social Platforms in One Place</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-12">Connect once, and we pull the metrics that matter for every social channel your clients use.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORMS.map(({ name, metrics }) => (
              <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
                <h3 className="text-lg font-body font-semibold text-amw-offwhite mb-3">{name}</h3>
                <div className="flex flex-wrap gap-2">
                  {metrics.map(m => <span key={m} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-body">{m}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">What's in a Social Media Report</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">Every report includes the key social metrics your clients care about — beautifully formatted and branded.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {METRICS_GRID.map(m => (
              <div key={m} className="p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
                <p className="text-sm font-body text-amw-offwhite/70">{m}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">Who It's For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map(({ title, desc, href }) => (
              <Link key={title} to={href} className="group p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left hover:border-primary/50 transition-colors">
                <h3 className="text-sm font-body font-semibold mb-2 group-hover:text-primary transition-colors">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">Branded Reports Your Clients Will Love</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-8">
            Every social media report is generated with your agency branding — your logo, your colours, your fonts. On the Agency plan, you can even serve the client portal from your own custom domain.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Your logo on every page', 'Your brand colours', 'Custom fonts', 'Custom domain support', 'No AMW branding visible'].map(f => (
              <span key={f} className="flex items-center gap-2 px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">
                <Check className="h-3 w-3 text-accent" /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Social Media Reporting FAQ</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
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

      <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Reporting on Social Media Today</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. No credit card required.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default SocialMediaReportingPage;
