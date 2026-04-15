import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import { getPlatformLogo } from '@/lib/platformLogos';

const PLATFORMS = [
  { name: 'Google Ads', category: 'Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Conv. Value', 'CPC', 'CPM', 'ROAS', 'Cost/Conv.', 'Search Imp. Share'], link: '/ppc-reporting' },
  { name: 'Meta Ads', category: 'Ads', metrics: ['Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'ROAS', 'Frequency', 'Leads'], link: '/ppc-reporting' },
  { name: 'TikTok Ads', category: 'Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'Reach', 'Video Views', 'Conversion Rate'], link: '/ppc-reporting' },
  { name: 'LinkedIn Ads', category: 'Ads', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conversion Rate', 'Cost/Conv.', 'Engagement'], link: '/ppc-reporting' },
  { name: 'Google Analytics', category: 'SEO', metrics: ['Sessions', 'Active Users', 'New Users', 'Page Views', 'Bounce Rate', 'Avg. Session Duration', 'Pages/Session', 'Traffic Sources'], link: '/seo-reporting' },
  { name: 'Google Search Console', category: 'SEO', metrics: ['Search Clicks', 'Search Impressions', 'Search CTR', 'Avg. Position', 'Top Queries', 'Top Pages'], link: '/seo-reporting' },
  { name: 'Google Business Profile', category: 'SEO', metrics: ['Views', 'Searches', 'Calls', 'Direction Requests', 'Website Clicks', 'Reviews Count', 'Avg. Rating'], link: '/seo-reporting' },
  { name: 'Facebook', category: 'Social', metrics: ['Page Likes', 'Followers', 'Reach', 'Impressions', 'Engagement', 'Reactions', 'Comments', 'Shares', 'Video Views'], link: '/social-media-reporting' },
  { name: 'Instagram', category: 'Social', metrics: ['Followers', 'Reach', 'Impressions', 'Engagement', 'Likes', 'Comments', 'Saves', 'Shares', 'Reels', 'Carousels'], link: '/social-media-reporting' },
  { name: 'LinkedIn', category: 'Social', metrics: ['Followers', 'Follower Growth', 'Impressions', 'Engagement', 'Clicks', 'Reactions', 'Comments', 'Shares'], link: '/social-media-reporting' },
  { name: 'YouTube', category: 'Social', metrics: ['Subscribers', 'Views', 'Watch Time', 'Avg. View Duration', 'Videos Published', 'Top Videos'], link: '/social-media-reporting' },
  { name: 'TikTok', category: 'Social', metrics: ['Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Video Views'], link: '/social-media-reporting' },
  { name: 'Pinterest', category: 'Social', metrics: ['Impressions', 'Engagements', 'Pin Clicks', 'Saves', 'Outbound Clicks', 'Total Audience'], link: '/social-media-reporting' },
  { name: 'Threads', category: 'Social', metrics: ['Followers', 'Views', 'Likes', 'Replies', 'Reposts', 'Quotes', 'Clicks', 'Engagement Rate'], link: '/social-media-reporting' },
];

const COMING_SOON = ['X (Twitter)', 'Shopify', 'Bing Ads', 'Snapchat Ads', 'Mailchimp'];

const IntegrationsPage = () => {
  usePageMeta({
    title: 'Integrations — 14 Marketing Platforms | AMW Reports',
    description: 'Connect Google Ads, Meta Ads, LinkedIn Ads, Analytics, Search Console, YouTube, Facebook, Instagram, LinkedIn, TikTok, Pinterest, Threads & more.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={26} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">Our Integrations</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Platform Integrations —<br />Connect Your <span className="text-gradient-purple">Marketing Stack</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            One dashboard for all your marketing data. Connect 14 platforms and pull 70+ metrics into branded, client-ready reports automatically.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-16 section-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">All platforms</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">All Supported Platforms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORMS.map(({ name, category, metrics, link }) => (
              <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  {getPlatformLogo(name) && <img src={getPlatformLogo(name)} alt="" className="h-5 w-5 object-contain" />}
                  <h3 className="text-lg font-body font-semibold text-amw-offwhite">{name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-sidebar-accent/60 text-[10px] font-body text-amw-offwhite/50 uppercase tracking-wider">{category}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {metrics.map(m => <span key={m} className="px-2.5 py-1 rounded-full bg-amw-orange/15 text-amw-orange text-xs font-body">{m}</span>)}
                </div>
                <Link to={link} className="text-xs font-body text-primary hover:underline flex items-center gap-1">
                  Learn more <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Roadmap</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Coming Soon</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-8">
            We're always adding new integrations. Here's what's on our roadmap:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {COMING_SOON.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 border-dashed text-xs font-body text-amw-offwhite/50">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">How Marketing Platform Integrations Work</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            AMW Reports connects to each marketing platform using official OAuth integrations — the same secure authentication method recommended by Google, Meta, LinkedIn, TikTok, and Pinterest. When you connect a platform, you authorise AMW Reports to read your analytics data through the platform's official API. Your passwords are never stored or transmitted — we use encrypted access tokens that can be revoked at any time from your platform settings.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Once connected, data syncing happens automatically on a schedule that depends on your plan. Agency plans sync data daily, ensuring your dashboards and reports always reflect the most recent performance. Freelance plans sync weekly (every Monday), and the free Creator plan syncs monthly. During each sync, AMW Reports pulls the latest metrics from every connected platform — ad spend, impressions, clicks, conversions, followers, engagement, video views, website traffic, search rankings, and more.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The platform currently supports fourteen marketing integrations spanning three categories. Paid advertising integrations include Google Ads, Meta Ads (Facebook and Instagram advertising), TikTok Ads, and LinkedIn Ads — covering spend tracking, conversion metrics, ROAS, and campaign-level breakdowns. SEO and web analytics integrations include Google Search Console, Google Analytics (GA4), and Google Business Profile — tracking search rankings, website traffic, and local business visibility. Organic social integrations include Facebook Pages, Instagram, LinkedIn, YouTube, TikTok, Pinterest, and Threads — monitoring follower growth, engagement, and content performance.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            Each integration pulls platform-specific metrics that are meaningful for that channel. For example, Google Ads tracks metrics like Search Impression Share and Cost per Conversion, while Instagram tracks Saves, Reels performance, and Carousel engagement. This platform-specific depth, combined with the ability to view all data in one unified dashboard and generate a single branded report, is what makes AMW Reports a comprehensive marketing integration hub rather than a shallow data aggregator.
          </p>
        </div>
      </section>

      {/* ── SEO: FAQ ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Integration FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'Is connecting my platforms secure?', a: 'Yes. We use official OAuth connections from each platform. Your passwords are never stored. Access tokens are encrypted at rest and can be revoked at any time.' },
              { q: 'How long does it take to connect a platform?', a: 'Most platforms connect in under 30 seconds. Click "Connect", authorise access in the platform popup, and your data starts syncing immediately.' },
              { q: 'What if a platform I need is not listed?', a: 'We are actively building new integrations. X (Twitter), Shopify, Bing Ads, Snapchat Ads, and Mailchimp are on our roadmap. Contact us if you have a specific request.' },
              { q: 'Can I connect multiple accounts for the same platform?', a: 'Yes. You can connect different accounts to different clients. For example, Client A can have one Google Ads account and Client B can have a different one.' },
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
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Connect Your Platforms Today</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. No credit card required.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default IntegrationsPage;
