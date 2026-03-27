import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, FileText, Mail, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import gaPlatform from '@/assets/screenshots/G4A.webp';

const FEATURES = [
  { icon: BarChart3, title: 'One Dashboard for Everything', desc: 'See all your marketing performance — ads, social, SEO, website — in a single, easy-to-understand dashboard.' },
  { icon: Layers, title: 'Clear Metrics, No Jargon', desc: 'We present your data in plain language with clear charts. No marketing expertise needed to understand your results.' },
  { icon: FileText, title: 'Branded PDF Reports', desc: 'Generate professional PDF reports with your business logo that you can share with stakeholders or keep for records.' },
  { icon: Mail, title: 'Automatic Email Delivery', desc: 'Receive your monthly marketing report by email automatically. No need to log in or remember to check.' },
];

const PLATFORMS = ['Google Ads', 'Meta Ads', 'Google Analytics', 'Google Search Console', 'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Pinterest', 'Google Business Profile'];

const ForSmbsPage = () => {
  usePageMeta({
    title: 'For Small Businesses — Marketing Analytics | AMW Reports',
    description: 'See all your marketing performance in one dashboard. Google, Meta, Instagram, LinkedIn & more. No expertise needed. Free.',
  });

  return (
    <>
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
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

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">What You Get</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
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
            <img
              src={gaPlatform}
              alt="Google Analytics reporting card showing sessions, active users, page views, bounce rate, and traffic sources — simple analytics for small businesses"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-8">All Your Marketing Tools in One Place</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Free Plan for Small Businesses</h2>
          <p className="text-amw-offwhite/60 font-body mb-8">
            The Creator plan is completely free — 1 client, 5 platform connections, branded PDF reports, and a client portal. No credit card needed. Perfect for small businesses that want to see their marketing data in one place.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">View All Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
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
