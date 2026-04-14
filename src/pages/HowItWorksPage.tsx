import { Link } from 'react-router-dom';
import { ArrowRight, Plug, RefreshCw, FileText, Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';

const PLATFORMS = ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'Google Analytics', 'Google Search Console', 'YouTube', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'TikTok Ads', 'Pinterest', 'Google Business Profile', 'Threads'];

const HowItWorksPage = () => {
  usePageMeta({
    title: 'How It Works — 3 Steps to Automated Reports',
    description: 'Connect your platforms, we sync the data daily, then generate and deliver branded PDF reports to your clients. See how.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={28} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="blue" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">How It Works</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            How AMW Reports Works —<br />From Connection to <span className="text-gradient-purple">Client Report</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Three simple steps to professional, branded marketing reports — delivered automatically to your clients every month.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-lg text-primary mb-2">Step one</p>
              <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Step 1: Connect Your Platforms</h2>
              <p className="text-amw-offwhite/60 font-body mb-6">
                Link your marketing platforms with a single click using secure OAuth connections. We support 14 platforms including Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads, LinkedIn, YouTube, Threads, and more. Your credentials are never stored — we use the same secure method that Google and Meta recommend.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <span key={p} className="px-3 py-1.5 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
                <Plug className="h-16 w-16 text-primary/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <div className="w-32 h-32 rounded-full bg-secondary/10 flex items-center justify-center">
                <RefreshCw className="h-16 w-16 text-secondary/40" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="font-accent text-lg text-primary mb-2">Step two</p>
              <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Step 2: We Sync Your Data</h2>
              <p className="text-amw-offwhite/60 font-body">
                Once connected, AMW Reports automatically pulls 70+ metrics across all your platforms. Agency plans sync daily, Freelance plans sync weekly (every Monday), and the free Creator plan syncs monthly on the 4th. Data is stored securely and ready for report generation at any time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 lg:py-28 section-light">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="green" className="absolute top-[10%] left-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-lg text-primary mb-2">Step three</p>
              <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Step 3: Generate & Deliver Reports</h2>
              <p className="text-amw-offwhite/60 font-body mb-6">
                Generate branded PDF reports with a single click or let them run automatically. Reports go through a robust 3-stage pipeline (Queued → Generating → Delivered) and are emailed directly to your clients. They can also access an interactive dashboard via a unique shareable link.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs font-body text-amw-offwhite/60">
                  <FileText className="h-4 w-4 text-primary" /> Branded PDF
                </div>
                <div className="flex items-center gap-2 text-xs font-body text-amw-offwhite/60">
                  <Mail className="h-4 w-4 text-primary" /> Email Delivery
                </div>
                <div className="flex items-center gap-2 text-xs font-body text-amw-offwhite/60">
                  <Share2 className="h-4 w-4 text-primary" /> Client Portal
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-full bg-accent/10 flex items-center justify-center">
                <FileText className="h-16 w-16 text-accent/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Report preview</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">What a Report Looks Like</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-8">
            Every PDF report includes a branded cover page, platform-by-platform sections with charts and key metrics, month-over-month comparisons, and a summary of performance highlights. All formatted with your agency logo, colours, and fonts.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Branded Cover Page', 'Platform Sections', 'Charts & Graphs', 'Key Metrics', 'MoM Comparisons', 'Top Content', 'Performance Summary', 'Your Brand Throughout'].map(item => (
              <div key={item} className="p-4 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 text-center hover:border-primary/50 transition-colors">
                <p className="text-xs font-body text-amw-offwhite/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Ready to Automate Your Reporting?</h2>
          <p className="text-amw-offwhite/60 font-body">Free plan available. Set up in under 5 minutes.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default HowItWorksPage;
