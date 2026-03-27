import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import googleAdsPlatform from '@/assets/screenshots/Google_ads.webp';
import metaAdsPlatform from '@/assets/screenshots/Meta_ads.webp';

const PLATFORMS = [
  { name: 'Google Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Conv. Value', 'CPC', 'CPM', 'ROAS', 'Cost/Conv.', 'Search Imp. Share'] },
  { name: 'Meta Ads', metrics: ['Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'ROAS', 'Frequency', 'Leads'] },
  { name: 'TikTok Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'Video Views'] },
];

const METRICS_GRID = ['Total Ad Spend', 'Return on Ad Spend', 'Cost Per Click', 'Cost Per Mille', 'Click-Through Rate', 'Conversions', 'Conversion Value', 'Cost Per Conversion', 'Impression Share', 'Frequency'];

const AUDIENCES = [
  { title: 'PPC Managers', desc: 'Show clients exactly how their ad budget is performing with clear spend, ROAS, and conversion data.' },
  { title: 'Performance Agencies', desc: 'Automate monthly ad performance reports across Google, Meta, and TikTok for every client.' },
  { title: 'Media Buyers', desc: 'Track multi-platform ad spend and performance in one consolidated, branded report.' },
];

const FAQS = [
  { q: 'What ad platforms does AMW Reports support?', a: 'We integrate with Google Ads, Meta Ads (Facebook & Instagram advertising), and TikTok Ads. All three can be included in a single client report.' },
  { q: 'Can I track ROAS and conversion data?', a: 'Yes. We pull spend, conversions, conversion value, and ROAS directly from each ad platform so you can demonstrate clear ROI to your clients.' },
  { q: 'Can I combine organic and paid data in the same report?', a: 'Absolutely. Each client report can include ad data alongside social media, SEO, and web analytics — giving clients a complete picture of their marketing performance.' },
  { q: 'How often is ad data synced?', a: 'Agency plans sync ad data daily. Freelance plans sync weekly (every Monday). The free Creator plan syncs monthly.' },
  { q: 'Is my ad account data secure?', a: 'Yes. We use official OAuth connections from Google, Meta, and TikTok. We never store your ad account passwords, and tokens are encrypted at rest.' },
];

const PpcReportingPage = () => {
  usePageMeta({
    title: 'PPC Reporting Tool — Google Ads & Meta Ads Reports',
    description: 'Track Google Ads, Meta Ads & TikTok Ads. Automated branded PPC reports with spend, ROAS, conversions & more. Free plan.',
  });

  return (
    <>
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            PPC & Ads Reporting Tool for <span className="text-gradient-purple">Agencies</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Track Google Ads, Meta Ads, and TikTok Ads in one dashboard. Automated branded PPC reports with spend, ROAS, conversions, and more. Free plan available.
          </p>
          <Button size="lg" asChild className="mb-12">
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>

          {/* Google Ads Screenshot */}
          <img
            src={googleAdsPlatform}
            alt="Google Ads reporting card showing ad spend, impressions, clicks, CTR, conversions, conversion value, CPC, CPM, and ROAS"
            className="w-full max-w-3xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <section className="py-16 bg-white/[0.03] border-t border-sidebar-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Ad Platforms We Integrate With</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="grid grid-cols-1 gap-6">
              {PLATFORMS.map(({ name, metrics }) => (
                <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
                  <h3 className="text-lg font-body font-semibold text-amw-offwhite mb-3">{name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {metrics.map(m => <span key={m} className="px-2.5 py-1 rounded-full bg-amw-orange/15 text-amw-orange text-xs font-body">{m}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <img
              src={metaAdsPlatform}
              alt="Meta Ads reporting card showing spend, impressions, reach, clicks, CTR, CPC, CPM, conversions, ROAS, frequency, and leads"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">What's in a PPC Report</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {METRICS_GRID.map(m => (
              <div key={m} className="p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
                <p className="text-sm font-body text-amw-offwhite/70">{m}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-white/[0.03] border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">Who It's For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map(({ title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left">
                <h3 className="text-sm font-body font-semibold mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">PPC Reporting FAQ</h2>
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
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Reporting on PPC Today</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. No credit card required.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default PpcReportingPage;
