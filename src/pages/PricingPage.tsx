import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X, ChevronDown, FileText, Share2, BarChart3, Mail, Info, Sparkles, Users, Clock, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';

const UNIVERSAL_FEATURES = [
  { icon: FileText, label: 'Branded PDF Reports', desc: 'Professional reports with your logo and colours, auto-generated every month.' },
  { icon: Share2, label: 'Client Portal', desc: 'A shareable link for each client — no login needed for them to view their dashboard.' },
  { icon: BarChart3, label: '14 Platform Integrations', desc: 'Connect Google Ads, Meta Ads, LinkedIn Ads, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads and more.' },
  { icon: Mail, label: 'Monthly Reports', desc: 'Automated report generation delivered to your inbox or your clients\' inbox.' },
];

const PLANS = [
  {
    name: 'Creator',
    price: 'Free',
    period: '',
    desc: 'Perfect for trying out the platform with a single client.',
    audience: 'Best for solo marketers testing the waters.',
    cta: 'Get Started Free',
    href: '/login?view=signup',
    highlight: false,
    features: ['1 client', '5 platform connections', 'Branded PDF reports', 'Client portal', 'Weekly sync (Monday)'],
  },
  {
    name: 'Freelance',
    price: '£29.99',
    period: '/month',
    desc: 'For freelancers and small teams managing multiple clients.',
    audience: 'Best for freelancers with 2–10 clients.',
    cta: 'Get Started',
    href: '/login?view=signup',
    highlight: false,
    features: ['5 clients included', '25 platform connections', 'Weekly data sync', '12 months historical data sync', 'Branded PDF reports', 'Automated email delivery', 'AI-powered analysis', 'Add-on clients £9.99/mo each', 'Add-on connections £9.99/mo (5 pack)'],
  },
  {
    name: 'Agency',
    price: '£49.99',
    period: '/month',
    desc: 'Full white-label branding and custom domain for your agency.',
    audience: 'Best for agencies wanting full brand control.',
    cta: 'Get Started',
    href: '/login?view=signup',
    highlight: true,
    features: ['5 clients included', '25 platform connections', 'Daily data sync', '24 months historical data sync', 'Full white-label branding', 'Custom domain support', 'AI-powered analysis', 'Automated email delivery', 'Add-on clients £9.99/mo each', 'Add-on connections £9.99/mo (5 pack)'],
  },
];

interface ComparisonRow {
  feature: string;
  tooltip: string;
  creator: boolean | string;
  freelance: boolean | string;
  agency: boolean | string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Clients Included', tooltip: 'A client is one of your customers. Each client has their own dashboard, connections, and reports.', creator: '1', freelance: '5', agency: '5' },
  { feature: 'Connections Included', tooltip: 'A connection links one client to one platform. E.g. connecting Google Ads + Instagram for one client = 2 connections.', creator: '5', freelance: '25', agency: '25' },
  { feature: 'Data Sync Frequency', tooltip: 'How often we pull fresh data from your connected platforms. More frequent = more up-to-date dashboards.', creator: 'Weekly', freelance: 'Weekly', agency: 'Daily' },
  { feature: 'Historical Data Sync', tooltip: 'How many months of historical data we import when you first connect a platform.', creator: '12 months', freelance: '12 months', agency: '24 months' },
  { feature: 'Branded PDF Reports', tooltip: 'Professionally designed PDF reports with your branding, generated automatically from your data.', creator: true, freelance: true, agency: true },
  { feature: 'Client Portal', tooltip: 'A unique shareable link for each client to view their live dashboard — no login required for them.', creator: true, freelance: true, agency: true },
  { feature: 'AI-Powered Analysis', tooltip: 'An AI assistant that analyses your marketing data and provides plain-English insights, trends, and recommendations.', creator: false, freelance: true, agency: true },
  { feature: 'Automated Email Delivery', tooltip: 'Automatically send reports to your clients via email on a schedule you choose.', creator: false, freelance: true, agency: true },
  { feature: 'Team Members', tooltip: 'Invite team members to your organisation to collaborate on client management and reporting.', creator: '1', freelance: 'Unlimited', agency: 'Unlimited' },
  { feature: 'Report Customisation', tooltip: 'Choose which metrics appear per platform, reorder sections, and toggle features like month-over-month comparisons.', creator: 'Basic', freelance: 'Full', agency: 'Full' },
  { feature: 'White-Label Branding', tooltip: 'Remove all AMW Reports branding. Your logo, colours, and fonts appear everywhere — reports, portal, and emails.', creator: false, freelance: false, agency: true },
  { feature: 'Custom Domain', tooltip: 'Use your own domain (e.g. reports.youragency.com) for the client portal instead of our default URL.', creator: false, freelance: false, agency: true },
  { feature: 'Data Retention', tooltip: 'How long we store your historical data. Longer retention means more trend analysis and year-over-year comparisons.', creator: '6 months', freelance: '24 months', agency: 'Unlimited' },
  { feature: 'Email Support', tooltip: 'Priority and response time for email support queries.', creator: 'Community', freelance: 'Standard', agency: 'Priority' },
  { feature: 'Additional Clients', tooltip: 'Add more clients beyond your plan\'s included amount. Each add-on client comes with 5 connections (3 reserved + 2 flexible).', creator: false, freelance: '£9.99/mo each', agency: '£9.99/mo each' },
  { feature: 'Additional Connections', tooltip: 'Buy extra connections in packs of 5, usable across any client. Great for clients with many platforms.', creator: false, freelance: '£9.99/mo (5 pack)', agency: '£9.99/mo (5 pack)' },
];

const FAQS = [
  { q: 'What is automated marketing reporting?', a: 'Automated marketing reporting is the process of pulling data from multiple marketing platforms (like Google Ads, Meta, Instagram, LinkedIn) and generating professional reports without manual work. AMW Reports handles the data collection, formatting, and delivery automatically — saving you hours every month.' },
  { q: 'What counts as a connection?', a: 'A connection is a single link between one client and one platform. For example, connecting Google Ads and Instagram for the same client uses 2 connections.' },
  { q: 'How does connection allocation work for add-on clients?', a: 'Each additional client account includes 5 connections — 3 are reserved exclusively for that client, and 2 are added to your flexible pool that can be used across any client. This ensures every client has a minimum level of coverage while giving you flexibility.' },
  { q: 'Can I white-label the reports with my agency brand?', a: 'Yes! On the Agency plan, you get full white-label branding. Upload your logo, set your brand colours and fonts, and even use a custom domain. Your clients will see your brand throughout the platform and on PDF reports — AMW Reports branding is completely hidden.' },
  { q: 'What is the difference between a connection and a client?', a: 'A client represents one of your customers or accounts. A connection is a link between that client and a specific marketing platform. One client might have 3-5 connections (e.g., Google Ads, Facebook, Instagram, Google Analytics, LinkedIn).' },
  { q: 'What platforms are supported?', a: 'We currently support Google Ads, Meta Ads, LinkedIn Ads, Google Analytics, Google Search Console, YouTube, Facebook Pages, Instagram, LinkedIn, TikTok, TikTok Ads, Pinterest, Google Business Profile, and Threads — 14 platforms in total.' },
  { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. You can upgrade at any time and the change takes effect immediately. If you downgrade, it takes effect at the end of your current billing period.' },
  { q: 'Is there a contract or commitment?', a: 'No contracts. All plans are month-to-month and you can cancel at any time.' },
  { q: 'Do my clients need an account?', a: 'No. Clients can access their dashboard via a unique shareable link — no login required for them.' },
  { q: 'How often is my data synced?', a: 'Creator plans sync data once per month on the 4th. Freelance plans sync weekly (every Monday). Agency plans benefit from daily automatic syncing to keep your dashboards always up to date.' },
  { q: 'How does AMW Reports compare to other reporting tools?', a: 'Unlike tools like DashThis or AgencyAnalytics that charge per dashboard or per user, AMW Reports offers a flat monthly price with no per-seat fees. You get full white-label branding, automated PDF generation, and a client portal — all included. Plus, we offer a genuinely free plan to get started.' },
  { q: 'What is white-label branding?', a: 'White-label branding lets you replace AMW Reports branding with your own. Upload your logo, set your brand colours and fonts, and even use a custom domain — your clients will see your brand throughout the platform and on PDF reports.' },
];

const CellValue = ({ value }: { value: boolean | string }) => {
  if (typeof value === 'string') return <span className="text-sm font-body text-amw-offwhite/80">{value}</span>;
  return value ? <Check className="h-4 w-4 text-accent mx-auto" aria-label="Included" /> : <X className="h-4 w-4 text-amw-offwhite/20 mx-auto" aria-label="Not included" />;
};

const FeatureTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="inline-flex items-center ml-1.5 text-amw-offwhite/30 hover:text-primary transition-colors">
        <Info className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" align="center" className="z-[9999] max-w-xs whitespace-normal break-words overflow-visible text-xs leading-relaxed">
      {text}
    </TooltipContent>
  </Tooltip>
);

const PricingPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  usePageMeta({
    title: 'Pricing — Free & Paid Plans | AMW Reports',
    description: 'Start free with 1 client. Upgrade to Freelance or Agency for white-label reports. No contracts, cancel anytime.',
  });

  return (
    <TooltipProvider delayDuration={200}>
      {/* Hero */}
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={24} color="purple" className="absolute top-[15%] right-[10%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[20%] left-[6%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">Simple Pricing</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-xl mx-auto">
            Start free. Upgrade when your agency grows. No hidden fees, no per-seat pricing.
          </p>
        </div>
      </section>

      {/* Universal Features */}
      <section className="pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs tracking-[0.2em] uppercase text-amw-offwhite/40 font-body text-center mb-2">What every plan includes</p>
          <p className="text-sm text-amw-offwhite/50 font-body text-center mb-6 max-w-lg mx-auto">
            Every plan — including the free one — comes with these core features out of the box.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {UNIVERSAL_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/30 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-body font-semibold text-amw-offwhite/90">{label}</span>
                </div>
                <span className="text-[11px] font-body text-amw-offwhite/50 leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* Plan Cards */}
      <section className="py-20 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-xl border flex flex-col ${
                  plan.highlight
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-sidebar-border/40 bg-sidebar-accent/30'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-body font-semibold">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-body font-semibold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-heading">{plan.price}</span>
                  {plan.period && <span className="text-sm text-amw-offwhite/50 font-body">{plan.period}</span>}
                </div>
                <p className="text-sm text-amw-offwhite/50 font-body mb-1">{plan.desc}</p>
                <p className="text-xs text-primary/70 font-body italic mb-5">{plan.audience}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm font-body text-amw-offwhite/80">
                      <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.highlight ? 'default' : 'outline'}>
                  <Link to={plan.href}>{plan.cta} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content Lab inclusion banner */}
      <section className="pb-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10 p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-accent text-sm text-primary mb-1">Bundled with every plan</p>
              <h3 className="text-lg lg:text-xl font-heading uppercase mb-1">Content Lab — AI content engine included</h3>
              <p className="text-sm text-amw-offwhite/65 font-body">
                12 ready-to-film ideas a month, hook & trend libraries, pipeline kanban, swipe file. Free plan includes 1 run/month — Studio gets 3, Agency gets 10.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/content-lab-feature">Learn more <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Side by side</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-3">Compare Plans</h2>
          <p className="text-sm text-amw-offwhite/50 font-body text-center mb-10 max-w-lg mx-auto">
            Hover or tap the <Info className="h-3 w-3 inline-block mx-0.5 text-amw-offwhite/40" /> icons for a plain-English explanation of each feature.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-sidebar-border/40">
                  <th className="py-3 pr-4 text-sm font-body font-semibold text-amw-offwhite/80">Feature</th>
                  <th className="py-3 px-4 text-sm font-body font-semibold text-center">Creator</th>
                  <th className="py-3 px-4 text-sm font-body font-semibold text-center">Freelance</th>
                  <th className="py-3 pl-4 text-sm font-body font-semibold text-center text-primary">Agency</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(({ feature, tooltip, creator, freelance, agency }) => (
                  <tr key={feature} className="border-b border-sidebar-border/20">
                    <td className="py-3 pr-4 text-sm font-body text-amw-offwhite/70 whitespace-nowrap">
                      {feature}
                      <FeatureTooltip text={tooltip} />
                    </td>
                    <td className="py-3 px-4 text-center"><CellValue value={creator} /></td>
                    <td className="py-3 px-4 text-center"><CellValue value={freelance} /></td>
                    <td className="py-3 pl-4 text-center"><CellValue value={agency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="border border-sidebar-border/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-body font-semibold text-amw-offwhite/90 hover:bg-sidebar-accent/20 transition-colors"
                >
                  {q}
                  <ChevronDown className={`h-4 w-4 text-amw-offwhite/40 transition-transform shrink-0 ml-2 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm font-body text-amw-offwhite/60 leading-relaxed">{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Understanding Marketing Report Pricing</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Marketing reporting tool pricing varies widely across the industry. Some platforms charge per dashboard, others charge per user seat, and many require annual contracts with significant upfront commitments. AMW Reports takes a different approach: simple, flat monthly pricing with no per-seat fees, no per-dashboard charges, and no annual contracts. Your entire team can access the platform for one transparent price.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The free Creator plan is not a limited trial — it is a permanent free tier that includes one client, five platform connections, branded PDF reports with your logo, and a client portal with a shareable link. There is no credit card required and no expiration date. This makes it ideal for freelancers testing the platform, small businesses tracking their own marketing, or creators monitoring their social media growth.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The Freelance plan at £29.99 per month is designed for marketing professionals managing two to ten clients. It includes five clients, twenty-five platform connections, weekly data syncing, twelve months of historical data imports, AI-powered marketing analysis, and automated email delivery. For freelancers, this represents exceptional value — professional reporting capabilities that rival enterprise tools, at a fraction of the cost.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            The Agency plan at £49.99 per month adds everything agencies need for a premium client experience: full white-label branding (your logo, colours, fonts across all reports and the portal), custom domain support, daily data syncing for always-current dashboards, and twenty-four months of historical data. Additional clients can be added at £9.99 per month each, and extra connection packs are available at the same price. This scalable pricing model means you only pay for what you use, with no hidden fees or surprise charges.
          </p>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Free, Upgrade When Ready</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Set up in under 5 minutes.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </TooltipProvider>
  );
};

export default PricingPage;
