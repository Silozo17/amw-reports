import { Link } from 'react-router-dom';
import { ArrowRight, Check, Palette, Globe, Mail, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import dashboardSnapshot from '@/assets/screenshots/Dashboard_Snapshot.webp';

const CUSTOMISE_CARDS = [
  { icon: Palette, title: 'Logo & Brand Colours', desc: 'Upload your agency logo and set your exact brand colours. Every PDF report and client portal page will reflect your identity.' },
  { icon: FileText, title: 'Custom Fonts', desc: 'Choose from a curated list of professional fonts to match your brand guidelines across all generated materials.' },
  { icon: Globe, title: 'Custom Domain', desc: 'Serve your client portal from your own domain (e.g., reports.youragency.com). Clients will never see AMW Reports branding.' },
  { icon: Mail, title: 'Branded Email Delivery', desc: 'Reports are delivered from your brand. Customise the email template with your logo and colours.' },
];

const STEPS = [
  { num: '01', title: 'Upload Your Branding', desc: 'Add your logo, set your brand colours and fonts in the settings panel. You can even auto-import branding from your website URL.' },
  { num: '02', title: 'Generate Reports', desc: 'Reports are automatically generated with your branding applied — cover page, charts, and metrics all match your visual identity.' },
  { num: '03', title: 'Clients See Your Brand', desc: 'Whether they receive a PDF by email or visit the client portal, clients see your agency — not ours.' },
];

const FAQS = [
  { q: 'What does white-label mean?', a: 'White-label means your clients see your brand everywhere — on PDF reports, in the client portal, on emails, and even on the URL if you use a custom domain. AMW Reports branding is completely hidden.' },
  { q: 'Which plan includes white-label branding?', a: 'Full white-label branding (including custom fonts, domain, and email templates) is available on the Agency plan at £49.99/month. All plans include your logo on PDF reports.' },
  { q: 'Can I use my own domain for the client portal?', a: 'Yes. On the Agency plan, you can set up a custom domain (e.g., reports.youragency.com) so clients access their dashboard under your URL.' },
  { q: 'Can I auto-import my branding from my website?', a: 'Yes! AMW Reports can analyse your website and automatically extract your brand colours, logo, and fonts — saving you time on setup.' },
  { q: 'Do all platforms support white-label?', a: 'Yes. White-label branding applies universally to all platforms, reports, and the client portal. It is not limited to specific integrations.' },
];

const WhiteLabelReportsPage = () => {
  usePageMeta({
    title: 'White-Label Reports — Your Brand, Your Reports',
    description: 'Fully branded PDF reports with your logo, colours, fonts, and custom domain. Present reports as your own. Free plan.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={26} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="orange" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">White Label</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            White-Label Marketing Reports for <span className="text-gradient-purple">Agencies</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Fully branded PDF reports with your logo, colours, fonts, and custom domain. Present reports as your own — clients will never know.
          </p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-16 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Customisation</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">What You Can Customise</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {CUSTOMISE_CARDS.map(({ icon: Icon, title, desc }) => (
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
        </div>
      </section>

      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={20} color="green" className="absolute top-[10%] right-[4%]" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">How it works</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">How White-Label Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40 hover:border-primary/50 transition-colors">
                <span className="text-xs font-body text-amw-offwhite/50">{num}</span>
                <h3 className="text-lg font-body font-semibold mb-2 mt-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>

          <img
            src={dashboardSnapshot}
            alt="AMW Reports branded dashboard showing how your agency branding appears across the client portal with custom colours, logo, and metrics"
            className="w-full max-w-5xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Client portal</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">A Branded Portal for Your Clients</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-8">
            Every client gets a unique shareable link to their own branded dashboard. They see your logo, your colours, and your domain — no AMW Reports branding visible.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['No login required for clients', 'Interactive charts & metrics', 'Download PDF reports', 'Custom domain URL', 'Fully branded experience'].map(f => (
              <span key={f} className="flex items-center gap-2 px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">
                <Check className="h-3 w-3 text-accent" /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Questions</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-10">White-Label FAQ</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
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
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Your Brand. Your Reports. Start Free.</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Full white-label on the Agency plan.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default WhiteLabelReportsPage;
