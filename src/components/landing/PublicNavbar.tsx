import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import amwLogo from '@/assets/AMW_Logo_White.png';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
];

const SOLUTIONS_USECASES = [
  { to: '/social-media-reporting', label: 'Social Media Reporting' },
  { to: '/seo-reporting', label: 'SEO Reporting' },
  { to: '/ppc-reporting', label: 'PPC & Ads Reporting' },
  { to: '/white-label-reports', label: 'White-Label Reports' },
];

const SOLUTIONS_AUDIENCES = [
  { to: '/for-agencies', label: 'For Agencies' },
  { to: '/for-freelancers', label: 'For Freelancers' },
  { to: '/for-smbs', label: 'For Small Businesses' },
  { to: '/for-creators', label: 'For Creators' },
];

const PublicNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solOpen, setSolOpen] = useState(false);
  const solRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (solRef.current && !solRef.current.contains(e.target as Node)) setSolOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); setSolOpen(false); }, [location.pathname]);

  const isSolutionPage = [...SOLUTIONS_USECASES, ...SOLUTIONS_AUDIENCES].some(s => location.pathname === s.to);

  return (
    <nav className="sticky top-0 z-50 bg-amw-black/90 backdrop-blur-md border-b border-sidebar-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={amwLogo} alt="AMW Reports" className="h-7 w-auto" width={112} height={28} />
            <span className="text-xs tracking-[0.25em] text-amw-offwhite/60 uppercase font-body">Reports</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-body font-medium transition-colors ${
                  location.pathname === to ? 'text-primary' : 'text-amw-offwhite/70 hover:text-amw-offwhite'
                }`}
              >
                {label}
              </Link>
            ))}

            {/* Solutions dropdown */}
            <div ref={solRef} className="relative">
              <button
                onClick={() => setSolOpen(!solOpen)}
                className={`text-sm font-body font-medium transition-colors flex items-center gap-1 ${
                  isSolutionPage ? 'text-primary' : 'text-amw-offwhite/70 hover:text-amw-offwhite'
                }`}
              >
                Solutions
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${solOpen ? 'rotate-180' : ''}`} />
              </button>
              {solOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-amw-black border border-sidebar-border/50 rounded-xl shadow-xl py-2 z-50">
                  <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-amw-offwhite/30 font-body">Use Cases</p>
                  {SOLUTIONS_USECASES.map(({ to, label }) => (
                    <Link key={to} to={to} className="block px-4 py-2 text-sm font-body text-amw-offwhite/70 hover:text-amw-offwhite hover:bg-sidebar-accent/30 transition-colors">
                      {label}
                    </Link>
                  ))}
                  <div className="my-1.5 border-t border-sidebar-border/30" />
                  <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-amw-offwhite/30 font-body">Built For</p>
                  {SOLUTIONS_AUDIENCES.map(({ to, label }) => (
                    <Link key={to} to={to} className="block px-4 py-2 text-sm font-body text-amw-offwhite/70 hover:text-amw-offwhite hover:bg-sidebar-accent/30 transition-colors">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="ghost" onClick={() => signOut()} className="text-amw-offwhite/80 hover:text-amw-offwhite hover:bg-sidebar-accent/50">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="text-amw-offwhite/80 hover:text-amw-offwhite hover:bg-sidebar-accent/50">
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link to="/login?view=signup">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-amw-offwhite/80 p-2"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-amw-black border-t border-sidebar-border/50 px-4 pb-4 space-y-1 max-h-[80vh] overflow-y-auto">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className={`block py-2 text-sm font-body font-medium ${location.pathname === to ? 'text-primary' : 'text-amw-offwhite/70'}`}>
              {label}
            </Link>
          ))}
          <p className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-amw-offwhite/30 font-body">Use Cases</p>
          {SOLUTIONS_USECASES.map(({ to, label }) => (
            <Link key={to} to={to} className={`block py-2 pl-2 text-sm font-body ${location.pathname === to ? 'text-primary' : 'text-amw-offwhite/70'}`}>
              {label}
            </Link>
          ))}
          <p className="pt-3 pb-1 text-[10px] uppercase tracking-wider text-amw-offwhite/30 font-body">Built For</p>
          {SOLUTIONS_AUDIENCES.map(({ to, label }) => (
            <Link key={to} to={to} className={`block py-2 pl-2 text-sm font-body ${location.pathname === to ? 'text-primary' : 'text-amw-offwhite/70'}`}>
              {label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            {user ? (
              <Button asChild className="w-full">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild className="w-full border-sidebar-border text-amw-offwhite">
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link to="/login?view=signup">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default PublicNavbar;
