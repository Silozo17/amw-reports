import { Link } from 'react-router-dom';
import { ArrowRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';

const AboutPage = () => {
  usePageMeta({
    title: 'About Us — The Story Behind AMW Reports',
    description: 'AMW Reports was built by AMW Media, a UK marketing agency tired of manual reporting. Now every agency can automate.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={28} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="green" className="absolute bottom-[25%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">Our Story</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            About AMW Reports —<br />Built by Marketers, for <span className="text-gradient-purple">Marketers</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto">
            AMW Reports was born from a real problem — spending too many hours every month building client reports manually. We built the tool we wished existed.
          </p>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">The problem</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">The Problem We Solved</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            At AMW Media, our UK-based marketing agency, we were logging into 10 different platforms every month for every client — pulling screenshots, copying data into spreadsheets, formatting slides, and sending them out manually. It was tedious, error-prone, and took hours away from the strategic work we actually enjoyed.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            We looked at the existing reporting tools on the market, but they were either too expensive for smaller agencies, too complex to set up, or lacked the white-label branding we needed to present reports as our own. So we built AMW Reports.
          </p>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">Our mission</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Make Professional Reporting Accessible to Every Marketer</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            Our mission is simple: make it possible for any marketing professional — whether you run a 50-person agency, freelance on your own, manage a small business, or create content — to deliver beautiful, branded, data-driven reports without the manual grind.
          </p>
          <p className="text-amw-offwhite/60 font-body leading-relaxed">
            We believe great reporting should not be a luxury reserved for agencies with big budgets. That is why we offer a genuinely free plan, transparent pricing, and no per-seat fees.
          </p>
        </div>
      </section>

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">What they say</p>
          <Quote className="h-10 w-10 text-primary/40 mx-auto mb-6" aria-hidden="true" />
          <blockquote className="text-xl lg:text-2xl font-body italic leading-relaxed text-amw-offwhite/90 mb-6">
            "We built AMW Reports because we were tired of spending hours manually compiling data from a dozen platforms. Our clients deserved better — and so did we."
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

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary mb-2">Who we are</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Built by AMW Media</h2>
          <p className="text-amw-offwhite/60 font-body leading-relaxed mb-6">
            AMW Reports is developed and operated by{' '}
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" aria-label="Visit AMW Media website">
              AMW Media
            </a>
            , a UK-based marketing agency. We use AMW Reports ourselves every day to manage our own client reporting — which means every feature is built from real-world agency experience.
          </p>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Join Us. Start Free.</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Built by marketers who understand your workflow.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
