import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';

const WHY_POINTS = [
  { title: 'Save hours every month', desc: 'Stop manually pulling data from 10 platforms. AMW Reports does it automatically.' },
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
      <section className="py-20 lg:py-28 text-center">
        <div className="max-w-4xl mx-auto px-4">
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

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">Why Freelancers Love AMW Reports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {WHY_POINTS.map(({ title, desc }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
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

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative p-6 rounded-xl bg-sidebar-accent/30 border border-sidebar-border/40">
                <span className="text-xs font-body text-amw-offwhite/30">{num}</span>
                <h3 className="text-lg font-body font-semibold mb-2 mt-2">{title}</h3>
                <p className="text-sm text-amw-offwhite/60 font-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t border-sidebar-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Affordable Pricing for Freelancers</h2>
          <p className="text-amw-offwhite/60 font-body mb-8">
            Start free with the Creator plan (1 client, 5 connections). When you grow, upgrade to Freelance at just £29.99/month for 5 clients and 25 connections. No contracts, cancel anytime.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">View All Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section className="py-20 border-t border-sidebar-border/30 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
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
