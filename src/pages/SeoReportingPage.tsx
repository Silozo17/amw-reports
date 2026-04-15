import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import { getPlatformLogo } from '@/lib/platformLogos';
import gscPlatform from '@/assets/screenshots/gsc.webp';
import gaPlatform from '@/assets/screenshots/G4A.webp';

const PLATFORMS = [
  { name: 'Google Search Console', metrics: ['Search Clicks', 'Search Impressions', 'Search CTR', 'Avg. Position', 'Top Queries', 'Top Pages'] },
  { name: 'Google Analytics', metrics: ['Sessions', 'Active Users', 'New Users', 'Page Views', 'Bounce Rate', 'Avg. Session Duration', 'Pages/Session', 'Traffic Sources'] },
  { name: 'Google Business Profile', metrics: ['Views', 'Searches', 'Calls', 'Direction Requests', 'Website Clicks', 'Reviews Count', 'Avg. Rating'] },
];

const METRICS_GRID = ['Organic Clicks', 'Search Impressions', 'Average Position', 'Top Ranking Queries', 'Top Pages by Traffic', 'Bounce Rate', 'Session Duration', 'New vs Returning Users', 'GBP Calls & Directions', 'Review Ratings'];

const AUDIENCES = [
  { title: 'SEO Managers', desc: 'Present search performance data to clients in a clean, branded PDF — no more spreadsheet exports.' },
  { title: 'Digital Agencies', desc: 'Report on SEO alongside social and ads in a single unified report for each client.' },
  { title: 'Consultants', desc: 'Demonstrate the value of your SEO work with clear, automated monthly reports.' },
];

const FAQS = [
  { q: 'What SEO platforms does AMW Reports support?', a: 'We integrate with Google Search Console, Google Analytics (GA4), and Google Business Profile — the three core platforms for tracking organic search performance.' },
  { q: 'Can I include SEO and social media data in the same report?', a: 'Yes. AMW Reports consolidates data from all connected platforms into a single branded report. You can include SEO, social, and ads data together or configure each client to show only the relevant platforms.' },
  { q: 'Does AMW Reports track keyword rankings?', a: 'We pull top queries and average position data directly from Google Search Console. This shows you which keywords are driving traffic and how your rankings are trending month over month.' },
  { q: 'How often is SEO data updated?', a: 'Agency plans sync daily. Freelance plans sync weekly (every Monday). The free Creator plan syncs monthly. Note that Google Search Console data itself has a 2-3 day delay from Google.' },
  { q: 'Can I white-label the SEO reports?', a: 'Yes. On the Agency plan, reports feature your logo, brand colours, fonts, and can be served from your own custom domain.' },
];

const SeoReportingPage = () => {
  usePageMeta({
    title: 'SEO Reporting Tool — Automated SEO Reports',
    description: 'Track Google Search Console, Analytics & Business Profile. Automated branded SEO reports for agencies. Start free.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={24} color="blue" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[18%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">SEO Reporting</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            SEO Reporting Tool —<br />Automated Search <span className="text-gradient-purple">Performance Reports</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Track Google Search Console, Google Analytics, and Google Business Profile in one dashboard. Generate branded SEO reports automatically. Free plan available.
          </p>
          <Button size="lg" asChild className="mb-12">
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>

          <img
            src={gscPlatform}
            alt="Google Search Console reporting card showing search clicks, impressions, CTR, average position, top queries, and top pages"
            className="w-full max-w-3xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-16 section-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Integrations</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">SEO Platforms We Integrate With</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="grid grid-cols-1 gap-6">
              {PLATFORMS.map(({ name, metrics }) => (
                <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    {getPlatformLogo(name) && <img src={getPlatformLogo(name)} alt="" className="h-5 w-5 object-contain" />}
                    <h3 className="text-lg font-body font-semibold text-amw-offwhite">{name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {metrics.map(m => <span key={m} className="px-2.5 py-1 rounded-full bg-amw-orange/15 text-amw-orange text-xs font-body">{m}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <img
              src={gaPlatform}
              alt="Google Analytics reporting card showing sessions, active users, new users, page views, bounce rate, and traffic sources"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Report contents</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">What's in an SEO Report</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {METRICS_GRID.map(m => (
              <div key={m} className="p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <p className="text-sm font-body text-amw-offwhite/70">{m}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Who it's for</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">Who It's For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left hover:border-primary/50 transition-colors">
                <h3 className="text-sm font-body font-semibold mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">SEO Reporting FAQ</h2>
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

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">The Complete SEO Reporting Solution</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Effective SEO reporting requires bringing together data from multiple Google properties into a single, coherent narrative for your clients. AMW Reports integrates with Google Search Console, Google Analytics (GA4), and Google Business Profile to give you a complete view of organic search performance — from keyword rankings and click-through rates to website traffic patterns and local business visibility.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Google Search Console data reveals which search queries drive traffic to your client's website, their average position in search results, and how many impressions and clicks they receive. AMW Reports pulls this data automatically and presents it alongside top pages by traffic, enabling you to identify which content performs well and where there are opportunities to improve rankings. The search performance trend chart shows how clicks, impressions, and CTR evolve month over month, making it easy to demonstrate the value of your SEO work.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Google Analytics integration adds website behaviour metrics — sessions, active users, new versus returning visitors, bounce rate, average session duration, pages per session, and traffic source breakdowns. Together with Search Console data, this paints a complete picture: not just how people find the website through search, but what they do once they arrive. For local businesses, Google Business Profile data adds calls, direction requests, website clicks, and review ratings.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            All of this data flows into a branded PDF report that is generated automatically and can be delivered to clients via email. For SEO agencies and consultants, AMW Reports eliminates the hours spent manually exporting data from Google tools, formatting spreadsheets, and building slide decks. The result is a professional, consistent SEO report that clearly demonstrates search performance improvements and justifies ongoing SEO investment.
          </p>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Reporting on SEO Today</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. No credit card required.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default SeoReportingPage;
