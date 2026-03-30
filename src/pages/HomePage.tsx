import { Link } from 'react-router-dom';
import { ArrowRight, Plug, RefreshCw, FileText, Check, Quote, BarChart3, Palette, Mail, Globe, Users, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WarpedGrid from '@/components/landing/WarpedGrid';
import StarDecoration from '@/components/landing/StarDecoration';
import amwLogo from '@/assets/AMW_Logo_White.png';
import dashboardSnapshot from '@/assets/screenshots/Dashboard_Snapshot.webp';
import perfOverview from '@/assets/screenshots/Performance_Overview.webp';
import usePageMeta from '@/hooks/usePageMeta';

const PLATFORMS = [
  'Google Ads', 'Meta Ads', 'Google Analytics', 'Google Search Console',
  'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'TikTok Ads', 'Pinterest', 'Google Business Profile',
];

const STEPS = [
  { icon: Plug, title: 'Connect', desc: 'Link your marketing platforms with one click — Google, Meta, TikTok, LinkedIn, and more.' },
  { icon: RefreshCw, title: 'Sync', desc: 'We automatically pull 70+ metrics across all your connected platforms every month.' },
  { icon: FileText, title: 'Report', desc: 'Beautiful, branded PDF reports are generated and emailed to your clients automatically.' },
];

const FEATURES = [
  { icon: BarChart3, title: 'Multi-Platform Analytics', desc: 'Pull data from 10+ marketing platforms into a single dashboard. No more switching between tools.' },
  { icon: FileText, title: 'Branded PDF Reports', desc: 'Automatically generated, beautifully designed PDF reports with your logo, colours, and branding.' },
  { icon: Mail, title: 'Automated Delivery', desc: 'Reports are emailed directly to your clients on schedule — no manual work required.' },
  { icon: Palette, title: 'White-Label Branding', desc: 'Your logo, your colours, your fonts, your domain. Clients see your brand, not ours.' },
  { icon: Share2, title: 'Client Portal', desc: 'Give clients access to an interactive dashboard via a unique shareable link — no login required.' },
  { icon: Globe, title: 'Custom Domain', desc: 'Serve your client portal from your own domain for a fully branded, professional experience.' },
];

const AUDIENCES = [
  { title: 'For Agencies', desc: 'Manage multiple clients, automate white-label reports, and scale your reporting effortlessly.', href: '/for-agencies' },
  { title: 'For Freelancers', desc: 'Look bigger than a one-person shop. Impress clients with professional branded reports.', href: '/for-freelancers' },
  { title: 'For Small Businesses', desc: 'See all your marketing performance in one dashboard. No jargon, no expertise needed.', href: '/for-smbs' },
  { title: 'For Creators', desc: 'Track your growth across platforms and generate sponsor-ready reports for brand deals.', href: '/for-creators' },
];

const WHY_US = [
  'White-label everything — your brand, your logo, your colours',
  'Automated monthly email delivery to your clients',
  '10+ platforms in one dashboard — no switching tools',
  'No per-seat pricing — your whole team for one price',
  'Built by marketers who run an agency themselves',
  'Client portal with shareable links for transparency',
];

const STAT_GROUPS = [
  { label: 'Ads', metrics: ['Spend', 'ROAS', 'CPC', 'Conversions', 'CTR'], color: 'text-primary' },
  { label: 'SEO', metrics: ['Clicks', 'Impressions', 'Position', 'Top Queries'], color: 'text-secondary' },
  { label: 'Social', metrics: ['Followers', 'Engagement', 'Reach', 'Video Views'], color: 'text-accent' },
  { label: 'Web', metrics: ['Sessions', 'Bounce Rate', 'Page Views', 'Traffic Sources'], color: 'text-warning' },
];

const HomePage = () => {
  usePageMeta({
    title: 'AMW Reports — Client-Ready Marketing Reports',
    description: 'Consolidate 10+ platforms into branded PDF reports. Free plan available. Built for agencies, freelancers, and creators.',
  });

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <WarpedGrid />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px]" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={32} color="purple" className="absolute top-[15%] right-[10%]" />
          <StarDecoration size={18} color="blue" className="absolute top-[30%] right-[25%]" animated={false} />
          <StarDecoration size={24} color="green" className="absolute bottom-[20%] left-[8%]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <img src={amwLogo} alt="AMW Reports logo" className="h-10 w-auto mb-2" />
                <p className="font-accent text-xl text-primary mb-1">We Are AMW Reports</p>
                <p className="text-sm tracking-[0.2em] text-amw-offwhite/70 uppercase font-body font-semibold">AMW Reports</p>
              </div>
              <h1 className="text-4xl lg:text-6xl xl:text-7xl font-heading leading-[0.95] uppercase">
                All Your Marketing Data.<br />
                One <span className="text-gradient-purple">Beautiful</span> Report.
              </h1>
              <p className="font-body text-lg max-w-lg leading-relaxed text-amw-offwhite/70">
                AMW Reports pulls data from Google, Meta, TikTok, LinkedIn and more into clean, client-ready reports — automatically. Built for agencies, freelancers, and creators.
              </p>
              <div className="flex items-center gap-3 text-xs font-body text-amw-offwhite/50 tracking-wide uppercase">
                <span>10 Platforms</span>
                <span className="w-1 h-1 rounded-full bg-primary" />
                <span>70+ Metrics</span>
                <span className="w-1 h-1 rounded-full bg-primary" />
                <span>Free Plan Available</span>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" asChild>
                  <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/features">See Features</Link>
                </Button>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <img
                src={dashboardSnapshot}
                alt="AMW Reports dashboard showing multi-platform marketing analytics with KPI cards, charts, and performance metrics"
                className="w-full max-w-xl rounded-xl border border-sidebar-border/30 shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── GRADIENT DIVIDER ── */}
      <div className="gradient-divider w-full" />

      {/* ── PLATFORM STRIP ── */}
      <section className="py-12 section-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Our Integrations</p>
          <p className="text-xs tracking-[0.2em] uppercase text-amw-offwhite/40 font-body mb-6">Connects with the tools you already use</p>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map((p) => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="orange" className="absolute top-[10%] right-[5%]" />
          <StarDecoration size={14} color="blue" className="absolute bottom-[15%] left-[3%]" animated={false} />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">The Challenge</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase text-center mb-4">
            Stop Copy-Pasting Data.<br />Start Impressing Clients.
          </h2>
          <p className="text-amw-offwhite/60 font-body max-w-2xl mx-auto text-center mb-12">
            Marketing professionals waste hours every month manually pulling data from multiple platforms, formatting spreadsheets, and building reports. AMW Reports eliminates that entirely.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-colors">
              <h3 className="text-lg font-body font-semibold mb-3 text-destructive">The Problem</h3>
              <ul className="space-y-2 text-sm font-body text-amw-offwhite/60">
                <li>• Hours wasted logging into 10 different platforms</li>
                <li>• Messy spreadsheets and inconsistent formatting</li>
                <li>• Manual copy-pasting prone to errors</li>
                <li>• Reports that don't reflect your agency brand</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl bg-accent/5 border border-accent/20 hover:border-accent/40 transition-colors">
              <h3 className="text-lg font-body font-semibold mb-3 text-accent">The Solution</h3>
              <ul className="space-y-2 text-sm font-body text-amw-offwhite/60">
                <li>• One dashboard for all your marketing data</li>
                <li>• Automated, branded PDF reports every month</li>
                <li>• Delivered straight to your clients via email</li>
                <li>• Full white-label — your brand, not ours</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={22} color="green" className="absolute top-[8%] left-[6%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">How it works</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">Three Steps to Professional Reports</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
            Connect your platforms, we handle the rest. Reports ready to present to clients.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <span className="absolute top-4 left-4 text-xs font-body text-amw-offwhite/30">0{i + 1}</span>
                <h3 className="text-lg font-body font-semibold mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>

          {/* Performance Overview Screenshot */}
          <div className="mt-16">
            <img
              src={perfOverview}
              alt="AMW Reports performance overview showing monthly trends, engagement charts, and platform comparison data"
              className="w-full max-w-5xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── BUILT FOR ── */}
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={16} color="purple" className="absolute top-[12%] right-[8%]" animated={false} />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Who we serve</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">Built for Marketing Professionals</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
            Whether you're an agency, freelancer, small business, or creator — AMW Reports has you covered.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {AUDIENCES.map(({ title, desc, href }) => (
              <Link key={href} to={href} className="group p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left hover:border-primary/50 transition-colors">
                <h3 className="text-sm font-body font-semibold mb-2 group-hover:text-primary transition-colors">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body mb-3">{desc}</p>
                <span className="text-xs font-body text-primary flex items-center gap-1">
                  Learn more <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── GRADIENT DIVIDER ── */}
      <div className="gradient-divider w-full" />

      {/* ── KEY FEATURES ── */}
      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={18} color="orange" className="absolute bottom-[10%] right-[4%]" />
          <StarDecoration size={26} color="blue" className="absolute top-[5%] left-[10%]" animated={false} />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">What you get</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">Everything You Need in One Platform</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
            A client-ready reporting and analytics platform that consolidates all your data into one clean, easy-to-digest format.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left hover:border-primary/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-body font-semibold mb-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METRICS AT A GLANCE ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">At a glance</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">70+ Metrics Across 10 Platforms</h2>
          <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
            From ad spend to follower growth, we track everything your clients care about.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STAT_GROUPS.map(({ label, metrics, color }) => (
              <div key={label} className="p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left hover:border-primary/50 transition-colors">
                <h3 className={`text-sm font-body font-semibold uppercase tracking-wide mb-3 ${color}`}>{label}</h3>
                <ul className="space-y-1.5">
                  {metrics.map((m) => (
                    <li key={m} className="text-sm text-amw-offwhite/60 font-body flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${color} bg-current`} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY AMW REPORTS ── */}
      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="green" className="absolute top-[15%] right-[6%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-lg text-primary mb-2">Why us</p>
              <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">Why Teams Choose AMW Reports</h2>
              <p className="text-amw-offwhite/60 font-body mb-8">
                We're not just another reporting tool. We built this platform because we run an agency ourselves and know exactly what you need.
              </p>
            </div>
            <ul className="space-y-4">
              {WHY_US.map((point) => (
                <li key={point} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-accent" />
                  </div>
                  <span className="text-sm font-body text-amw-offwhite/80">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FOUNDER QUOTE ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">What they say</p>
          <Quote className="h-10 w-10 text-primary/40 mx-auto mb-6" aria-hidden="true" />
          <blockquote className="text-xl lg:text-2xl font-body italic leading-relaxed text-amw-offwhite/90 mb-6">
            "We built AMW Reports because we were tired of spending hours manually compiling data from a dozen platforms. Our clients deserved better — and so did we. Now every agency can deliver professional, branded reports without the grind."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-heading text-lg">A</div>
            <div className="text-left">
              <p className="text-sm font-body font-semibold text-amw-offwhite">Amir</p>
              <p className="text-xs font-body text-amw-offwhite/50">Founder, AMW Media</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GRADIENT DIVIDER ── */}
      <div className="gradient-divider w-full" />

      {/* ── CTA BANNER ── */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-transparent to-primary/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Free. No Credit Card Required.</h2>
          <p className="text-amw-offwhite/60 font-body">Set up in under 5 minutes. Upgrade when your agency grows.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default HomePage;
