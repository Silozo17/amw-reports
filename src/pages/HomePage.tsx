import { Link } from 'react-router-dom';
import { ArrowRight, Plug, RefreshCw, FileText, Check, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WarpedGrid from '@/components/landing/WarpedGrid';
import StarDecoration from '@/components/landing/StarDecoration';
import mascot from '@/assets/mascot.svg';
import amwLogo from '@/assets/AMW_Logo_White.png';

const PLATFORMS = [
  'Google Ads', 'Meta Ads', 'Google Analytics', 'Google Search Console',
  'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Google Business Profile',
];

const STEPS = [
  { icon: Plug, title: 'Connect', desc: 'Link your marketing platforms with one click — Google, Meta, TikTok, LinkedIn, and more.' },
  { icon: RefreshCw, title: 'Sync', desc: 'We automatically pull 70+ metrics across all your connected platforms every month.' },
  { icon: FileText, title: 'Report', desc: 'Beautiful, branded PDF reports are generated and emailed to your clients automatically.' },
];

const WHY_US = [
  'White-label everything — your brand, your logo, your colours',
  'Automated monthly email delivery to your clients',
  '10 platforms in one dashboard — no switching tools',
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

const HomePage = () => (
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
              <img src={amwLogo} alt="AMW Reports" className="h-10 w-auto mb-2" />
              <p className="text-sm tracking-[0.2em] text-amw-offwhite/70 uppercase font-body font-semibold">AMW Reports</p>
            </div>
            <p className="font-accent text-2xl lg:text-3xl text-primary">
              We Are AMW Media
              <span className="inline-block w-[2px] h-[1em] bg-primary ml-1 align-middle animate-pulse" />
            </p>
            <h1 className="text-4xl lg:text-6xl xl:text-7xl font-heading leading-[0.95] uppercase">
              Automated Marketing<br />Reports That<br />
              <span className="text-gradient-purple">Elevate</span> Your Agency
            </h1>
            <p className="font-body text-lg max-w-md leading-relaxed text-amw-offwhite/70">
              AMW Reports connects 10+ marketing platforms, generates stunning branded PDF reports, and delivers insights to your clients — automatically.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" asChild className="border border-amw-offwhite/30 bg-transparent text-amw-offwhite hover:bg-amw-offwhite/10">
                <Link to="/features">See Features</Link>
              </Button>
            </div>
          </div>
          <div className="hidden lg:flex justify-center">
            <img src={mascot} alt="AMW Media mascot" className="w-72 lg:w-[26rem] xl:w-[30rem] object-contain" />
          </div>
        </div>
      </div>
    </section>

    {/* ── PLATFORM LOGOS ── */}
    <section className="py-12 border-y border-sidebar-border/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-amw-offwhite/40 font-body mb-6">Trusted Integrations</p>
        <div className="flex flex-wrap justify-center gap-4">
          {PLATFORMS.map((p) => (
            <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* ── HOW IT WORKS ── */}
    <section className="py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">How It Works</h2>
        <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
          Three simple steps to professional, branded reports your clients will love.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <span className="absolute top-4 left-4 text-xs font-body text-amw-offwhite/30">0{i + 1}</span>
              <h3 className="text-lg font-body font-semibold mb-2">{title}</h3>
              <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── STATS AT A GLANCE ── */}
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">70+ Metrics Across 10 Platforms</h2>
        <p className="text-amw-offwhite/60 font-body max-w-xl mx-auto mb-12">
          From ad spend to follower growth, we track everything your clients care about.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STAT_GROUPS.map(({ label, metrics, color }) => (
            <div key={label} className="p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-left">
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
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl lg:text-5xl font-heading uppercase mb-4">Why AMW Reports?</h2>
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
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Quote className="h-10 w-10 text-primary/40 mx-auto mb-6" />
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

    {/* ── CTA BANNER ── */}
    <section className="py-20 lg:py-28 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl lg:text-5xl font-heading uppercase">Ready to Elevate Your Reporting?</h2>
        <p className="text-amw-offwhite/60 font-body">Start for free. No credit card required.</p>
        <Button size="lg" asChild>
          <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  </>
);

export default HomePage;
