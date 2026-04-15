import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, FileText, Mail, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import gaPlatform from '@/assets/screenshots/G4A.webp';

const FEATURES = [
  { icon: BarChart3, title: 'One Dashboard for Everything', desc: 'See all your marketing performance — ads, social, SEO, website — in a single, easy-to-understand dashboard.' },
  { icon: Layers, title: 'Clear Metrics, No Jargon', desc: 'We present your data in plain language with clear charts. No marketing expertise needed to understand your results.' },
  { icon: FileText, title: 'Branded PDF Reports', desc: 'Generate professional PDF reports with your business logo that you can share with stakeholders or keep for records.' },
  { icon: Mail, title: 'Automatic Email Delivery', desc: 'Receive your monthly marketing report by email automatically. No need to log in or remember to check.' },
];

const PLATFORMS = ['Google Ads', 'Meta Ads', 'Google Analytics', 'Google Search Console', 'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'TikTok Ads', 'Pinterest', 'Google Business Profile', 'Threads'];

const ForSmbsPage = () => {
  usePageMeta({
    title: 'For Small Businesses — Marketing Analytics | AMW Reports',
    description: 'See all your marketing performance in one dashboard. Google, Meta, Instagram, LinkedIn & more. No expertise needed. Free.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={24} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">For Small Businesses</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Marketing Reports for <span className="text-gradient-purple">Small Businesses</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Understand your marketing without the jargon. See all your performance data in one clean dashboard and get beautiful PDF reports delivered automatically. Free plan available.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">What you get</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">What You Get</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
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
              src={gaPlatform}
              alt="Google Analytics reporting card showing sessions, active users, page views, bounce rate, and traffic sources — simple analytics for small businesses"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Integrations</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-8">All Your Marketing Tools in One Place</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Pricing</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Free Plan for Small Businesses</h2>
          <p className="text-amw-offwhite/60 font-body mb-8">
            The Creator plan is completely free — 1 client, 5 platform connections, branded PDF reports, and a client portal. No credit card needed. Perfect for small businesses that want to see their marketing data in one place.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">View All Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* ── SEO: Long-form ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">In depth</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Marketing Analytics Made Simple for Small Businesses</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Running a small business means wearing many hats, and marketing analytics often falls to the bottom of the priority list — not because it is unimportant, but because it feels overwhelming. Google Ads has one dashboard, Facebook has another, Instagram has its own insights, Google Analytics is a maze of menus, and Google Business Profile has yet another interface. For a small business owner without a marketing background, making sense of all this data can feel impossible.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            AMW Reports solves this by bringing all your marketing data into a single, clean dashboard that presents information in plain language with clear charts. You do not need to understand marketing jargon or know how to navigate complex analytics platforms. The dashboard shows you the metrics that matter — how much you are spending on ads, how many people visited your website, whether your social media following is growing, and how customers are finding your business on Google.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            The platform generates branded PDF reports that you can share with business partners, investors, or keep for your own records. If you work with a marketing agency or freelancer, the client portal gives you a shareable link to view your performance data at any time without needing to log in or create an account. This transparency helps you understand what your marketing spend is actually achieving.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            The free Creator plan is perfectly suited for small businesses — connect up to five marketing platforms, see your data in one dashboard, and generate PDF reports at no cost. Whether you run a local restaurant tracking Google Business Profile reviews and direction requests, an e-commerce store monitoring Google Ads and Meta Ads performance, or a service business watching LinkedIn engagement and website traffic, AMW Reports gives you the marketing dashboard for small businesses that actually makes sense.
          </p>
        </div>
      </section>

      {/* ── SEO: FAQ ── */}
      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">Small Business Marketing FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'Do I need marketing experience to use AMW Reports?', a: 'No. The platform presents your data in plain language with clear charts. No marketing expertise is needed to understand your results.' },
              { q: 'Is AMW Reports free for small businesses?', a: 'Yes. The Creator plan is completely free — connect up to 5 platforms, see your data in one dashboard, and generate PDF reports. No credit card required.' },
              { q: 'Can I track my Google Business Profile reviews?', a: 'Yes. AMW Reports integrates with Google Business Profile and tracks views, searches, calls, direction requests, website clicks, review counts, and average ratings.' },
              { q: 'How is this different from just checking each platform myself?', a: 'AMW Reports saves you time by pulling data from all platforms into one place, presenting it in a consistent format, and generating professional reports automatically. No more switching between dashboards.' },
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
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">See Your Marketing Clearly</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. Set up in under 5 minutes.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default ForSmbsPage;
