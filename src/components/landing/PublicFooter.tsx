import { Link } from 'react-router-dom';
import amwLogo from '@/assets/AMW_Logo_White.png';

const PublicFooter = () => (
  <footer className="bg-amw-black border-t border-sidebar-border/50 text-amw-offwhite/70">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <img src={amwLogo} alt="AMW Reports" className="h-7 w-auto" />
            <span className="text-xs tracking-[0.25em] text-amw-offwhite/50 uppercase font-body">Reports</span>
          </div>
          <p className="text-sm font-body leading-relaxed max-w-sm">
            Automated marketing reports that elevate your agency. Built by marketers, for marketers.
          </p>
          <p className="text-xs text-amw-offwhite/40 font-body">
            Operated by{' '}
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" className="text-amw-offwhite/60 hover:text-primary transition-colors underline">
              AMW Media
            </a>
          </p>
        </div>

        {/* Product links */}
        <div className="space-y-3">
          <h4 className="text-sm font-body font-semibold text-amw-offwhite">Product</h4>
          <div className="flex flex-col gap-2 text-sm font-body">
            <Link to="/features" className="hover:text-primary transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Log In</Link>
            <Link to="/login?view=signup" className="hover:text-primary transition-colors">Sign Up</Link>
          </div>
        </div>

        {/* Legal links */}
        <div className="space-y-3">
          <h4 className="text-sm font-body font-semibold text-amw-offwhite">Legal</h4>
          <div className="flex flex-col gap-2 text-sm font-body">
            <a href="https://amwmedia.co.uk/privacy-policy" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Privacy Policy" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="https://amwmedia.co.uk/terms-and-conditions" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Terms and Conditions" className="hover:text-primary transition-colors">Terms & Conditions</a>
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" aria-label="Visit AMW Media website" className="hover:text-primary transition-colors">amwmedia.co.uk</a>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-sidebar-border/30 text-xs text-amw-offwhite/40 font-body">
        © {new Date().getFullYear()} AMW Reports. All rights reserved.
      </div>
    </div>
  </footer>
);

export default PublicFooter;
