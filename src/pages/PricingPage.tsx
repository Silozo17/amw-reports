import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    desc: 'Perfect for trying out the platform with a single client.',
    cta: 'Get Started Free',
    href: '/login?view=signup',
    highlight: false,
    features: ['1 client', '5 platform connections', 'Branded PDF reports', 'Client portal', 'Monthly sync'],
  },
  {
    name: 'Agency',
    price: '£49.99',
    period: '/month',
    desc: 'For growing agencies managing multiple clients.',
    cta: 'Get Started',
    href: '/login?view=signup',
    highlight: true,
    features: ['5 clients included', '25 platform connections', 'Full white-label branding', 'Custom domain support', 'Automated email delivery', 'Priority support'],
  },
  {
    name: 'Custom',
    price: 'Flexible',
    period: '',
    desc: 'Agency plan plus pay-as-you-grow add-ons.',
    cta: 'Contact Us',
    href: 'mailto:hello@amwmedia.co.uk',
    highlight: false,
    features: ['Everything in Agency', '+ £9.99/mo per extra client', '+ £4.99/mo per extra connection', 'Unlimited overrides available', 'Dedicated account support'],
  },
];

const COMPARISON_ROWS = [
  { feature: 'Clients included', starter: '1', agency: '5', custom: 'Unlimited' },
  { feature: 'Connections included', starter: '5', agency: '25', custom: 'Unlimited' },
  { feature: 'Branded PDF Reports', starter: true, agency: true, custom: true },
  { feature: 'Client Portal', starter: true, agency: true, custom: true },
  { feature: 'White-Label Branding', starter: false, agency: true, custom: true },
  { feature: 'Custom Domain', starter: false, agency: true, custom: true },
  { feature: 'Automated Email Delivery', starter: false, agency: true, custom: true },
  { feature: 'Priority Support', starter: false, agency: true, custom: true },
  { feature: 'Additional Clients', starter: false, agency: false, custom: '£9.99/mo each' },
  { feature: 'Additional Connections', starter: false, agency: false, custom: '£4.99/mo each' },
];

const FAQS = [
  { q: 'What counts as a connection?', a: 'A connection is a single link between one client and one platform. For example, connecting Google Ads and Instagram for the same client uses 2 connections.' },
  { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. You can upgrade at any time and the change takes effect immediately. If you downgrade, it takes effect at the end of your current billing period.' },
  { q: 'Is there a contract or commitment?', a: 'No contracts. All plans are month-to-month and you can cancel at any time.' },
  { q: 'What platforms are supported?', a: 'We currently support Google Ads, Meta Ads, Google Analytics, Google Search Console, YouTube, Facebook Pages, Instagram, LinkedIn, TikTok, and Google Business Profile.' },
  { q: 'Do my clients need an account?', a: 'No. Clients can access their dashboard via a unique shareable link — no login required for them.' },
];

const CellValue = ({ value }: { value: boolean | string }) => {
  if (typeof value === 'string') return <span className="text-sm font-body text-amw-offwhite/80">{value}</span>;
  return value ? <Check className="h-4 w-4 text-accent mx-auto" /> : <X className="h-4 w-4 text-amw-offwhite/20 mx-auto" />;
};

const PricingPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      {/* Hero */}
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-xl mx-auto">
            Start free. Upgrade when your agency grows. No hidden fees, no per-seat pricing.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-20">
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
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-heading">{plan.price}</span>
                  {plan.period && <span className="text-sm text-amw-offwhite/50 font-body">{plan.period}</span>}
                </div>
                <p className="text-sm text-amw-offwhite/50 font-body mb-6">{plan.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm font-body text-amw-offwhite/80">
                      <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.highlight ? 'default' : 'outline'}
                  className={!plan.highlight ? 'border-sidebar-border text-amw-offwhite hover:bg-sidebar-accent/50' : ''}
                >
                  {plan.href.startsWith('mailto') ? (
                    <a href={plan.href}>{plan.cta} <ArrowRight className="ml-2 h-4 w-4" /></a>
                  ) : (
                    <Link to={plan.href}>{plan.cta} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 border-t border-sidebar-border/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-sidebar-border/40">
                  <th className="py-3 pr-4 text-sm font-body font-semibold text-amw-offwhite/80">Feature</th>
                  <th className="py-3 px-4 text-sm font-body font-semibold text-center">Starter</th>
                  <th className="py-3 px-4 text-sm font-body font-semibold text-center text-primary">Agency</th>
                  <th className="py-3 pl-4 text-sm font-body font-semibold text-center">Custom</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(({ feature, starter, agency, custom }) => (
                  <tr key={feature} className="border-b border-sidebar-border/20">
                    <td className="py-3 pr-4 text-sm font-body text-amw-offwhite/70">{feature}</td>
                    <td className="py-3 px-4 text-center"><CellValue value={starter} /></td>
                    <td className="py-3 px-4 text-center"><CellValue value={agency} /></td>
                    <td className="py-3 pl-4 text-center"><CellValue value={custom} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-sidebar-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="border border-sidebar-border/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left text-sm font-body font-semibold text-amw-offwhite/90 hover:bg-sidebar-accent/20 transition-colors"
                >
                  {q}
                  <ChevronDown className={`h-4 w-4 text-amw-offwhite/40 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm font-body text-amw-offwhite/60 leading-relaxed">{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Free, Upgrade When Ready</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Set up in under 5 minutes.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default PricingPage;
