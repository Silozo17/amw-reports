import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import instagramPlatform from '@/assets/screenshots/instagram.webp';

const WHY_POINTS = [
  { title: 'Save hours every month', desc: 'Stop manually pulling data from 14 platforms. AMW Reports does it automatically.' },
  { title: 'Impress clients with professional reports', desc: 'Branded PDF reports with your logo make you look like a full-service agency.' },
  { title: 'White-label your deliverables', desc: 'Clients see your brand on every report and portal page. They will never know you use AMW Reports.' },
  { title: 'Start free, upgrade when ready', desc: 'The Creator plan is free with 1 client and 5 connections. Upgrade to Freelance at just £29.99/mo.' },
];

const STEPS = [
  { num: '01', title: 'Sign up free', desc: 'Create your account in under 2 minutes. No credit card needed.' },
  { num: '02', title: 'Add your client', desc: 'Enter your client details, connect their marketing platforms.' },
  { num: '03', title: 'Generate reports', desc: 'We pull the data, format a branded PDF, and deliver it to your client.' },
];

const ForFreelancersPage = () => {
  usePageMeta({
    title: 'For Freelancers — Easy Client Reporting | AMW Reports',
    description: 'Impress clients with professional branded reports. Connect platforms, auto-generate PDFs, deliver by email. Free plan.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={24} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">For Freelancers</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Client Reporting Tool for <span className="text-gradient-purple">Freelance Marketers</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Look bigger than a one-person shop. Deliver professional, branded marketing reports to your clients — automatically. Free plan available.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-12 section-light">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="font-accent text-lg text-primary mb-2">What your clients see</p>
          <p className="text-xs tracking-[0.2em] uppercase text-amw-offwhite/40 font-body mb-6">Branded reporting in action</p>
          <img
            src={instagramPlatform}
            alt="Instagram analytics report showing follower growth, reach, impressions, engagement, likes, comments, saves, and profile visits — as delivered to clients"
            className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="orange" className="absolute top-[10%] right-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Why freelancers love us</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Why Freelancers Love AMW Reports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {WHY_POINTS.map(({ title, desc }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-accent" />
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

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">How it works</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <span className="text-xs font-body text-amw-offwhite/50">{num}</span>
                <h3 className="text-lg font-body font-semibold mb-2 mt-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Pricing</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Affordable Pricing for Freelancers</h2>
          <p className="text-amw-offwhite/60 font-body mb-8">
            Start free with the Creator plan (1 client, 5 connections). When you grow, upgrade to Freelance at just £29.99/month for 5 clients and 25 connections. No contracts, cancel anytime.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">View All Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Why Freelance Marketers Need a Reporting Tool</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            As a freelance marketer, your time is your most valuable asset. Every hour spent manually pulling data from Google Ads, Instagram Insights, Facebook Analytics, or Google Search Console is an hour you could spend on strategy, client communication, or finding new business. A freelancer reporting tool like AMW Reports automates the data collection and report generation process, giving you back those hours every month.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Client perception matters enormously for freelancers. Delivering a professionally branded PDF report — with your logo, colours, and consistent formatting — creates the impression of a well-organised, established business. AMW Reports generates these branded reports automatically from real-time data across fourteen marketing platforms, so your deliverables look like they came from a full-service agency even if you are a one-person operation.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The platform's pricing is designed with freelancers in mind. The free Creator plan lets you get started with one client and five platform connections at no cost — ideal for testing the platform or managing a single account. When you grow, the Freelance plan at just £29.99 per month supports five clients with twenty-five connections, weekly data syncing, twelve months of historical data, AI-powered analysis, and automated email delivery. No per-seat fees mean you pay one price regardless of whether you bring on a virtual assistant or subcontractor.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            Beyond reports, the client portal feature lets your clients access their own interactive dashboard via a shareable link — no account or login needed. This adds a layer of transparency that builds trust and reduces the number of "How did my Instagram do this month?" emails you receive. For freelancers managing marketing across social media, paid advertising, SEO, and web analytics, AMW Reports provides a single tool that covers all your client reporting needs.
          </p>
        </div>
      </section>

      {/* ── SEO: FAQ ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Freelancer Reporting FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'Is AMW Reports really free for freelancers?', a: 'Yes. The Creator plan is free forever — 1 client, 5 platform connections, branded PDF reports, and a client portal. No credit card required. Upgrade to Freelance at £29.99/month when you need more clients.' },
              { q: 'Can I white-label reports as a freelancer?', a: 'All plans include your logo on PDF reports. For full white-label branding (custom colours, fonts, domain), you would need the Agency plan at £49.99/month.' },
              { q: 'How does AMW Reports help me win new clients?', a: 'Professional branded reports demonstrate competence and build trust. The client portal gives prospects a preview of the reporting experience they will receive, which can be a strong selling point during pitches.' },
              { q: 'What happens if I outgrow the Freelance plan?', a: 'You can add extra clients at £9.99/month each, or upgrade to the Agency plan for full white-label branding, daily syncing, and custom domain support.' },
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

      {/* Content Lab cross-sell */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 p-8 lg:p-10 flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-accent text-sm text-primary mb-2">Sell more than reports · Separate subscription. From £49/mo.</p>
              <h2 className="text-2xl lg:text-3xl font-heading uppercase mb-3">Add Content Lab to your service stack.</h2>
              <p className="text-amw-offwhite/65 font-body mb-5">
                Charge for strategy, not screenshots. Run monthly content research for each client, hand over 12 ready-to-film ideas with hooks and scripts, and track production on a kanban board — all under your brand.
              </p>
              <Button asChild>
                <Link to="/content-lab-feature">Explore Content Lab <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Start Free. Look Professional.</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Set up in under 5 minutes.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default ForFreelancersPage;
