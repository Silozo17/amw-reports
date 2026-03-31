import { BarChart3, FileText, Users, Palette } from 'lucide-react';
import WarpedGrid from './WarpedGrid';
import StarDecoration from './StarDecoration';
import mascot from '@/assets/mascot.svg';
import amwLogo from '@/assets/AMW_Logo_White.png';

const FEATURES = [
  { icon: BarChart3, title: 'Multi-Platform Analytics', desc: 'Google, Meta, TikTok Ads, LinkedIn & more — all in one place' },
  { icon: FileText, title: 'Automated Reports', desc: 'Beautiful branded PDFs generated and emailed monthly' },
  { icon: Users, title: 'Client Management', desc: 'Manage clients, recipients, and platform connections' },
  { icon: Palette, title: 'White-Label Ready', desc: 'Your brand, your logo, your colours — fully customisable' },
];

const LandingHero = () => {
  return (
    <section className="relative h-full min-h-screen flex items-center bg-amw-black text-amw-offwhite overflow-hidden">
      <WarpedGrid />

      {/* Glowing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px] animate-pulse-glow" />
      </div>

      {/* Star decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <StarDecoration size={32} color="purple" className="absolute top-[15%] right-[10%]" />
        <StarDecoration size={18} color="blue" className="absolute top-[25%] right-[25%]" animated={false} />
        <StarDecoration size={24} color="green" className="absolute bottom-[20%] left-[8%]" />
        <StarDecoration size={14} color="orange" className="absolute top-[40%] left-[15%]" animated={false} />
        <StarDecoration size={20} color="offwhite" className="absolute bottom-[30%] right-[15%] opacity-20" />
      </div>

      <div className="relative z-10 px-8 xl:px-12 py-12 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-center">
          {/* Text content */}
          <div className="animate-fade-up-in">
            {/* Branding */}
            <div className="mb-8">
              <img src={amwLogo} alt="AMW Reports" className="h-10 w-auto" width={160} height={40} />
              <p className="text-sm tracking-[0.2em] text-amw-offwhite/70 uppercase font-body font-semibold">AMW Reports</p>
            </div>

            {/* Accent text */}
            <p className="font-accent text-2xl xl:text-3xl text-primary mb-4">
              We Are AMW Media
              <span className="inline-block w-[2px] h-[1em] bg-primary ml-1 align-middle animate-pulse" />
            </p>

            <h2 className="text-4xl xl:text-6xl 2xl:text-7xl font-heading leading-[0.95] uppercase mb-6">
              Automated Marketing<br />
              Reports That<br />
              <span className="text-gradient-purple">Elevate</span> Your Agency
            </h2>

            <p className="font-body text-lg max-w-md leading-relaxed text-amw-offwhite/70">
              Connect your marketing platforms, generate stunning branded reports, and deliver insights to your clients — automatically.
            </p>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 rounded-lg bg-sidebar-accent/40 backdrop-blur-sm border border-sidebar-border/50">
                  <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-body font-semibold">{title}</p>
                    <p className="text-xs text-amw-offwhite/60 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mascot illustration */}
          <div className="hidden xl:flex justify-center items-center">
            <img
              src={mascot}
              alt="AMW Media mascot"
              className="w-64 h-64 xl:w-[28rem] xl:h-[28rem] 2xl:w-[32rem] 2xl:h-[32rem] object-contain animate-hero-grow-in"
              width={448}
              height={448}
            />
          </div>
        </div>

      </div>
    </section>
  );
};

export default LandingHero;
