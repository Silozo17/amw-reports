import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Mail, Palette, Globe, Users, BarChart3, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORM_DETAILS = [
  {
    name: 'Google Ads',
    desc: 'Track ad performance, conversions, and return on ad spend across all your Google campaigns.',
    metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Conv. Value', 'CPC', 'CPM', 'ROAS', 'Cost/Conv.', 'Search Imp. Share'],
  },
  {
    name: 'Meta Ads',
    desc: 'Monitor your Facebook and Instagram ad campaigns with detailed spend, reach, and conversion metrics.',
    metrics: ['Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'ROAS', 'Frequency', 'Leads'],
  },
  {
    name: 'Google Analytics',
    desc: 'Understand your website traffic, user behaviour, and acquisition channels at a glance.',
    metrics: ['Sessions', 'Active Users', 'New Users', 'Page Views', 'Bounce Rate', 'Avg. Session Duration', 'Pages/Session', 'Traffic Sources'],
  },
  {
    name: 'Google Search Console',
    desc: 'See how your website performs in Google search — clicks, impressions, rankings, and top queries.',
    metrics: ['Search Clicks', 'Search Impressions', 'Search CTR', 'Avg. Position', 'Top Queries', 'Top Pages'],
  },
  {
    name: 'YouTube',
    desc: 'Track channel growth, video performance, and audience engagement for your YouTube presence.',
    metrics: ['Subscribers', 'Views', 'Watch Time', 'Avg. View Duration', 'Videos Published', 'Top Videos'],
  },
  {
    name: 'Facebook',
    desc: 'Monitor your Facebook Page performance including reach, engagement, and follower growth.',
    metrics: ['Page Likes', 'Followers', 'Reach', 'Impressions', 'Engagement', 'Reactions', 'Comments', 'Shares', 'Video Views', 'Posts Published'],
  },
  {
    name: 'Instagram',
    desc: 'Track your Instagram growth, content performance, and audience engagement.',
    metrics: ['Followers', 'Reach', 'Impressions', 'Engagement', 'Likes', 'Comments', 'Saves', 'Shares', 'Profile Visits', 'Reels', 'Carousels'],
  },
  {
    name: 'LinkedIn',
    desc: 'Monitor your LinkedIn company page with follower analytics and post performance.',
    metrics: ['Followers', 'Follower Growth', 'Impressions', 'Engagement', 'Clicks', 'Reactions', 'Comments', 'Shares', 'Posts Published'],
  },
  {
    name: 'TikTok',
    desc: 'Track your TikTok ad campaigns with detailed spend, reach, and engagement data.',
    metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'Video Views'],
  },
  {
    name: 'Google Business Profile',
    desc: 'See how customers find and interact with your Google Business listing.',
    metrics: ['Views', 'Searches', 'Calls', 'Direction Requests', 'Website Clicks', 'Reviews Count', 'Avg. Rating'],
  },
];

const REPORTING_FEATURES = [
  { icon: FileText, title: 'Branded PDF Reports', desc: 'Automatically generated, beautifully designed PDF reports with your agency branding, logo, and colour palette.' },
  { icon: Mail, title: 'Automated Email Delivery', desc: 'Reports are emailed directly to your clients on a monthly schedule — no manual work required.' },
  { icon: Palette, title: 'Full White-Label', desc: 'Customise everything — your logo, colours, fonts, and even your own custom domain for the client portal.' },
  { icon: Share2, title: 'Client Portal', desc: 'Give clients access to an interactive dashboard via a unique shareable link. No login required for them.' },
];

const AGENCY_TOOLS = [
  { icon: Users, title: 'Multi-Client Management', desc: 'Manage all your clients from a single dashboard. Add team members and assign roles.' },
  { icon: BarChart3, title: 'Per-Client Dashboards', desc: 'Each client gets their own configurable dashboard with the platforms and metrics that matter to them.' },
  { icon: Globe, title: 'Custom Domain', desc: 'Serve your client portal from your own domain for a fully branded experience.' },
];

const FeaturesPage = () => (
  <>
    {/* Hero */}
    <section className="py-20 lg:py-28 text-center">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
          Everything You Need to<br />Report Like a <span className="text-gradient-purple">Pro</span>
        </h1>
        <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto">
          10 platforms, 70+ metrics, branded PDFs, automated delivery, and a client portal — all in one place.
        </p>
      </div>
    </section>

    {/* Platform Deep Dives */}
    <section className="py-16 border-t border-sidebar-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">Platform Integrations</h2>
        <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-12">
          Connect once, sync automatically. Here's every metric we track for each platform.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLATFORM_DETAILS.map(({ name, desc, metrics }) => (
            <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
              <h3 className="text-lg font-body font-semibold text-amw-offwhite mb-1">{name}</h3>
              <p className="text-sm text-amw-offwhite/50 font-body mb-4">{desc}</p>
              <div className="flex flex-wrap gap-2">
                {metrics.map((m) => (
                  <span key={m} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-body">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Reporting Features */}
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Reporting & Delivery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {REPORTING_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-body font-semibold mb-1">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Agency Tools */}
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Agency Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AGENCY_TOOLS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-body font-semibold mb-2">{title}</h3>
              <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Your Free Account</h2>
        <p className="text-amw-offwhite/60 font-body">No credit card. No commitment. Upgrade when you're ready.</p>
        <Button size="lg" asChild>
          <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  </>
);

export default FeaturesPage;
