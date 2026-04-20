import { Link } from 'react-router-dom';
import amwLogo from '@/assets/AMW_Logo_White.png';

const PublicFooter = () => (
  <footer className="bg-amw-black border-t border-sidebar-border/50 text-amw-offwhite/70">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1 space-y-3">
          <div className="flex items-center gap-2">
            <img src={amwLogo} alt="AMW Reports" className="h-7 w-auto" width={112} height={28} />
            <span className="text-xs tracking-[0.25em] text-amw-offwhite/65 uppercase font-body">Reports</span>
          </div>
          <p className="text-xs font-body leading-relaxed max-w-xs">
            Client-ready marketing reports that consolidate all your data into one clean, branded format.
          </p>
          <p className="text-xs text-amw-offwhite/60 font-body">
            Operated by{' '}
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" aria-label="Visit AMW Media website" className="text-amw-offwhite/60 hover:text-primary transition-colors underline">
              AMW Media
            </a>
          </p>
        </div>

        {/* Product */}
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-amw-offwhite uppercase tracking-wider">Product</p>
          <div className="flex flex-col gap-2 text-sm font-body">
            <Link to="/features" className="hover:text-primary transition-colors">Features</Link>
            <Link to="/content-lab-feature" className="hover:text-primary transition-colors">Content Lab</Link>
            <Link to="/integrations" className="hover:text-primary transition-colors">Integrations</Link>
            <Link to="/how-it-works" className="hover:text-primary transition-colors">How It Works</Link>
            <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
          </div>
        </div>

        {/* Solutions */}
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-amw-offwhite uppercase tracking-wider">Solutions</p>
          <div className="flex flex-col gap-2 text-sm font-body">
            <Link to="/social-media-reporting" className="hover:text-primary transition-colors">Social Media Reporting</Link>
            <Link to="/seo-reporting" className="hover:text-primary transition-colors">SEO Reporting</Link>
            <Link to="/ppc-reporting" className="hover:text-primary transition-colors">PPC Reporting</Link>
            <Link to="/white-label-reports" className="hover:text-primary transition-colors">White-Label Reports</Link>
          </div>
        </div>

        {/* For */}
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-amw-offwhite uppercase tracking-wider">Built For</p>
          <div className="flex flex-col gap-2 text-sm font-body">
            <Link to="/for-agencies" className="hover:text-primary transition-colors">Agencies</Link>
            <Link to="/for-freelancers" className="hover:text-primary transition-colors">Freelancers</Link>
            <Link to="/for-smbs" className="hover:text-primary transition-colors">Small Businesses</Link>
            <Link to="/for-creators" className="hover:text-primary transition-colors">Creators</Link>
          </div>
        </div>

        {/* Company */}
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-amw-offwhite uppercase tracking-wider">Company</p>
          <div className="flex flex-col gap-2 text-sm font-body">
            <Link to="/about" className="hover:text-primary transition-colors">About</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Log In</Link>
            <a href="https://amwmedia.co.uk/privacy-policy" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Privacy Policy" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="https://amwmedia.co.uk/terms-and-conditions" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Terms and Conditions" className="hover:text-primary transition-colors">Terms</a>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-sidebar-border/30 text-xs text-amw-offwhite/60 font-body">
        © {new Date().getFullYear()} AMW Reports. All rights reserved.
      </div>
    </div>
  </footer>
);

export default PublicFooter;
