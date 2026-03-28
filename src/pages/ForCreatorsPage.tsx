import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Video, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import usePageMeta from '@/hooks/usePageMeta';
import StarDecoration from '@/components/landing/StarDecoration';
import youtubePlatform from '@/assets/screenshots/YouTube.webp';
import instagramPlatform from '@/assets/screenshots/instagram.webp';

const METRICS = [
  { icon: Users, title: 'Follower Growth', desc: 'Track your audience growth across YouTube, Instagram, TikTok, LinkedIn, and more — all in one dashboard.' },
  { icon: Video, title: 'Video Performance', desc: 'Views, watch time, average view duration, and top-performing videos — perfect for YouTube and TikTok creators.' },
  { icon: TrendingUp, title: 'Engagement Trends', desc: 'Likes, comments, shares, saves, and engagement rate — month over month — so you can show sponsors your trajectory.' },
  { icon: FileText, title: 'Sponsor-Ready Reports', desc: 'Generate branded PDF reports with your stats that you can share directly with sponsors and brand partners.' },
];

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Pinterest'];

const ForCreatorsPage = () => {
  usePageMeta({
    title: 'For Creators — Social Media Analytics | AMW Reports',
    description: 'Track your growth across YouTube, Instagram, TikTok, LinkedIn & more. Beautiful reports for sponsors and brand deals. Free.',
  });

  return (
    <>
      <section className="relative py-20 lg:py-28 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <StarDecoration size={26} color="purple" className="absolute top-[12%] right-[8%]" />
          <StarDecoration size={16} color="orange" className="absolute bottom-[20%] left-[5%]" animated={false} />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <p className="font-accent text-xl text-primary mb-2">For Creators</p>
          <h1 className="text-4xl lg:text-6xl font-heading uppercase mb-4">
            Social Media Analytics for <span className="text-gradient-purple">Content Creators</span>
          </h1>
          <p className="text-lg text-amw-offwhite/60 font-body max-w-2xl mx-auto mb-6">
            Show sponsors exactly what you are worth. Track your growth across YouTube, Instagram, TikTok, LinkedIn, and more — then generate beautiful reports for brand deals. Free plan available.
          </p>
          <Button size="lg" asChild className="mb-12">
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>

          <img
            src={youtubePlatform}
            alt="YouTube channel analytics showing subscribers, views, watch time, average view duration, videos published, and top-performing videos"
            className="w-full max-w-3xl mx-auto rounded-xl border border-sidebar-border/30 shadow-2xl"
          />
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">What you track</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-12">What Creators Track</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {METRICS.map(({ icon: Icon, title, desc }) => (
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
              src={instagramPlatform}
              alt="Instagram analytics showing followers, reach, impressions, engagement, likes, comments, saves, shares, and profile visits — perfect for creator media kits"
              className="w-full rounded-xl border border-sidebar-border/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Integrations</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-8">Platforms for Creators</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(p => (
              <span key={p} className="px-4 py-2 rounded-full bg-sidebar-accent/40 border border-sidebar-border/50 text-xs font-body text-amw-offwhite/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 section-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-accent text-lg text-primary text-center mb-2">Brand deals</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase text-center mb-4">Generate Reports for Brand Deals</h2>
          <p className="text-amw-offwhite/60 font-body text-center max-w-xl mx-auto mb-8">
            When a sponsor asks for your stats, generate a branded PDF with your follower count, engagement rate, video views, and growth trends. It takes seconds and looks professional.
          </p>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-accent text-lg text-primary mb-2">Pricing</p>
          <h2 className="text-2xl lg:text-4xl font-heading uppercase mb-4">Free Plan for Creators</h2>
          <p className="text-amw-offwhite/60 font-body mb-8">
            The Creator plan is completely free — connect up to 5 platforms, track your growth, and generate branded reports. No credit card needed.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">View All Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <div className="gradient-divider w-full" />

      <section className="py-20 bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <p className="font-accent text-lg text-primary mb-2">Get started</p>
          <h2 className="text-3xl lg:text-5xl font-heading uppercase">Show Your Worth. Start Free.</h2>
          <p className="text-amw-offwhite/60 font-body">No credit card required. Perfect for creators at any level.</p>
          <Button size="lg" asChild>
            <Link to="/login?view=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
};

export default ForCreatorsPage;
