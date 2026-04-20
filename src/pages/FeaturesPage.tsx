import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Mail, Palette, Globe, Users, BarChart3, Share2, Clock, Layers, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import dashboardSnapshot from '@/assets/screenshots/Dashboard_Snapshot.webp';
import perfOverview from '@/assets/screenshots/Performance_Overview.webp';

const PLATFORM_DETAILS = [
  { name: 'Google Ads', desc: 'Track ad performance, conversions, and return on ad spend across all your Google campaigns.', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'Conversions', 'Conv. Value', 'CPC', 'CPM', 'ROAS', 'Cost/Conv.', 'Search Imp. Share'] },
  { name: 'Meta Ads', desc: 'Monitor your Facebook and Instagram ad campaigns with detailed spend, reach, and conversion metrics.', metrics: ['Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'ROAS', 'Frequency', 'Leads'] },
  { name: 'Google Analytics', desc: 'Understand your website traffic, user behaviour, and acquisition channels at a glance.', metrics: ['Sessions', 'Active Users', 'New Users', 'Page Views', 'Bounce Rate', 'Avg. Session Duration', 'Pages/Session', 'Traffic Sources'] },
  { name: 'Google Search Console', desc: 'See how your website performs in Google search — clicks, impressions, rankings, and top queries.', metrics: ['Search Clicks', 'Search Impressions', 'Search CTR', 'Avg. Position', 'Top Queries', 'Top Pages'] },
  { name: 'YouTube', desc: 'Track channel growth, video performance, and audience engagement for your YouTube presence.', metrics: ['Subscribers', 'Views', 'Watch Time', 'Avg. View Duration', 'Videos Published', 'Top Videos'] },
  { name: 'Facebook', desc: 'Monitor your Facebook Page performance including reach, engagement, and follower growth.', metrics: ['Page Likes', 'Followers', 'Reach', 'Impressions', 'Engagement', 'Reactions', 'Comments', 'Shares', 'Video Views', 'Posts Published'] },
  { name: 'Instagram', desc: 'Track your Instagram growth, content performance, and audience engagement.', metrics: ['Followers', 'Reach', 'Impressions', 'Engagement', 'Likes', 'Comments', 'Saves', 'Shares', 'Profile Visits', 'Reels', 'Carousels'] },
  { name: 'LinkedIn', desc: 'Monitor your LinkedIn company page with follower analytics and post performance.', metrics: ['Followers', 'Follower Growth', 'Impressions', 'Engagement', 'Clicks', 'Reactions', 'Comments', 'Shares', 'Posts Published'] },
  { name: 'TikTok', desc: 'Track organic TikTok content performance including followers, views, likes, and engagement.', metrics: ['Followers', 'Views', 'Likes', 'Comments', 'Shares', 'Video Views'] },
  { name: 'TikTok Ads', desc: 'Track TikTok ad campaign performance with detailed spend, conversion, and reach metrics.', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conv. Value', 'Reach', 'Video Views', 'Conversion Rate'] },
  { name: 'LinkedIn Ads', desc: 'Monitor your LinkedIn advertising campaigns with spend tracking, conversion metrics, and professional audience engagement.', metrics: ['Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Conversions', 'Conversion Rate', 'Cost/Conv.', 'Engagement'] },
  { name: 'Google Business Profile', desc: 'See how customers find and interact with your Google Business listing.', metrics: ['Views', 'Searches', 'Calls', 'Direction Requests', 'Website Clicks', 'Reviews Count', 'Avg. Rating'] },
  { name: 'Pinterest', desc: 'Track your Pinterest presence with pin performance, impressions, and audience growth.', metrics: ['Impressions', 'Engagements', 'Pin Clicks', 'Saves', 'Outbound Clicks', 'Total Audience'] },
  { name: 'Threads', desc: 'Monitor your Threads presence with views, engagement, and follower growth.', metrics: ['Followers', 'Views', 'Likes', 'Replies', 'Reposts', 'Quotes', 'Clicks', 'Engagement Rate'] },
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

const PIPELINE_STEPS = [
  { icon: Clock, title: 'Queued', desc: 'Your report enters the generation queue. Multiple reports are processed fairly on a first-come, first-served basis.' },
  { icon: Layers, title: 'Generating', desc: 'Data is pulled from all connected platforms, formatted into branded sections, and compiled into a professional PDF.' },
  { icon: Shield, title: 'Delivered', desc: 'The finished report is emailed to your client and stored in your dashboard for future access and download.' },
];

const FeaturesPage = () => {
  usePageMeta({
    title: 'Features — Marketing Report Automation | AMW Reports',
    description: '14 platform integrations, 70+ metrics, branded PDFs, automated delivery, white-label client portal. Free plan.',
  });

  return (
    <>
      {/* Hero */}
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={28} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="blue" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-xl text-primary mb-2">Our Platform</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            All-in-One Marketing<br />Reporting <span className="text-gradient-purple">Platform</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            A client-ready reporting and analytics platform that consolidates data from 14 marketing platforms into one clean, branded, easy-to-digest format — ready to present to clients.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <Button size="lg" asChild>
              <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>

          <img
            src={dashboardSnapshot}
            alt="AMW Reports main dashboard showing client KPIs, platform connections, and multi-channel marketing analytics overview"
            className="w-full max-w-5xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* Platform Deep Dives */}
      <section className="py-16 section-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">All platforms</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">14 Platform Integrations, One Dashboard</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-12">
            Connect once, sync automatically. Here's every metric we track for each platform.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORM_DETAILS.map(({ name, desc, metrics }) => (
              <div key={name} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <h3 className="text-lg font-body font-semibold text-amw-offwhite mb-1">{name}</h3>
                <p className="text-sm text-amw-offwhite/50 font-body mb-4">{desc}</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-amw-orange/15 text-amw-orange text-xs font-body">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting Features */}
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="green" className="absolute top-[10%] right-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Reporting</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Automated Reporting & Delivery</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {REPORTING_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
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
            <img
              src={perfOverview}
              alt="Performance overview report showing monthly marketing trends with engagement metrics and platform comparison charts"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* How Reports Work */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">The pipeline</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">How Report Generation Works</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
            Reports go through a robust 3-stage pipeline to ensure the best possible outcome every time.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PIPELINE_STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <span className="absolute top-4 left-4 text-xs font-body text-amw-offwhite/50">0{i + 1}</span>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-body font-semibold mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Portal */}
      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-lg text-primary mb-2">Client portal</p>
              <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Give Clients Their Own Dashboard</h2>
              <p className="text-amw-offwhite/60 font-body mb-6">
                Every client gets a unique shareable link to their own branded portal — no login required. They see interactive charts, key metrics, and can download their latest report. It's transparency that builds trust.
              </p>
              <ul className="space-y-3 mb-6">
                {['Shareable link — no client account needed', 'Interactive charts and metric cards', 'Download latest PDF report', 'White-label with your branding', 'Custom domain support'].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm font-body text-amw-offwhite/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link to="/social-media-reporting">Social Media Reporting</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/seo-reporting">SEO Reporting</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/ppc-reporting">PPC Reporting</Link>
                </Button>
              </div>
            </div>
            <div className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-center">
              <Share2 className="h-16 w-16 text-primary/40 mx-auto mb-4" aria-hidden="true" />
              <p className="text-sm font-body text-amw-offwhite/50">Client portal preview — branded dashboard with your logo, colours, and metrics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Agency Tools */}
      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={22} color="orange" className="absolute bottom-[12%] left-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">For teams</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Agency Management Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AGENCY_TOOLS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-center hover:border-primary/50 transition-colors">
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

      {/* Content Lab spotlight */}
      <section className="py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-[auto,1fr,auto] gap-6 items-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-accent text-sm text-primary mb-1">New · Content Lab</p>
              <h3 className="text-xl lg:text-2xl font-heading uppercase mb-2">AI Content Engine — included for every plan</h3>
              <p className="text-sm text-amw-offwhite/65 font-body">
                Scrape what's working in your niche, decode the patterns, and ship 12 ready-to-film ideas every month — with hooks, scripts, filming checklists and phone-mockup previews.
              </p>
            </div>
            <Button asChild>
              <Link to="/content-lab-feature">Explore Content Lab <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── SEO: Deep Dive ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">Why it matters</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Why Automated Marketing Reports Matter</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Marketing agencies and freelancers spend an average of four to six hours per client each month manually building reports. That time is spent logging into platforms like Google Ads, Meta Ads, Google Analytics, and Instagram, copying data into spreadsheets, formatting charts, and assembling slides or PDFs. For an agency with twenty clients, that could mean over a hundred hours lost to reporting every single month — hours that should be spent on strategy, creative work, and growing your business.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            AMW Reports eliminates that manual work entirely. The platform connects to fourteen marketing platforms via secure OAuth integrations — the same authentication method recommended by Google, Meta, and LinkedIn. Once connected, data is synced automatically on a schedule that matches your plan tier: daily for Agency users, weekly for Freelance, and monthly for the free Creator plan. Every metric is pulled directly from the platform API, ensuring accuracy that manual screenshots and copy-pasting simply cannot match.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The branded PDF report feature transforms raw data into professional, client-ready documents. Each report includes a branded cover page with your agency logo, platform-by-platform sections with key metrics and charts, month-over-month comparisons, top-performing content breakdowns, and an executive summary. The report generation pipeline processes data through a three-stage queue — Queued, Generating, and Delivered — ensuring reliability even when generating reports for dozens of clients simultaneously.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            Beyond static reports, AMW Reports provides an interactive client portal where clients can explore their data through charts and metric cards via a unique shareable link — no login required for them. For agencies on the Agency plan, the portal can be served from a custom domain, creating a fully white-labelled experience. Combined with automated email delivery, AI-powered marketing analysis, and configurable per-client dashboards, AMW Reports provides everything a marketing professional needs to deliver exceptional client reporting at scale.
          </p>
        </div>
      </section>

      {/* ── SEO: FAQ ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Marketing Report Features FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'What features are included in the free plan?', a: 'The free Creator plan includes 1 client, 5 platform connections, branded PDF reports with your logo, a client portal with a shareable link, and monthly data syncing. It is a fully functional marketing reporting tool with no time limit and no credit card required.' },
              { q: 'How does the automated report delivery feature work?', a: 'On paid plans, AMW Reports generates PDF reports automatically each month and emails them directly to your clients using branded email templates. You can also trigger report generation manually at any time from your dashboard.' },
              { q: 'Can I choose which metrics appear in each client report?', a: 'Yes. Every client has a configurable dashboard where you can enable or disable specific platforms and metrics. You can also toggle features like month-over-month comparisons, AI-powered explanations, and health scores.' },
              { q: 'What is the client portal feature?', a: 'The client portal is an interactive, branded dashboard that your clients can access via a unique shareable link — no account or login needed. They see charts, metrics, and can download their latest PDF report. On the Agency plan, you can serve it from your own custom domain.' },
              { q: 'Does AMW Reports offer AI-powered marketing analysis?', a: 'Yes. On paid plans, the AI assistant analyses your marketing data and provides plain-English insights, trend identification, and actionable recommendations. It can answer questions about specific metrics, compare performance across periods, and highlight opportunities.' },
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

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Your Free Account Today</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card. No commitment. Upgrade when you're ready.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default FeaturesPage;
