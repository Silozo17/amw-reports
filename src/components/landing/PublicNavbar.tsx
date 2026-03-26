import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import amwLogo from '@/assets/AMW_Logo_White.png';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
];

const PublicNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-amw-black/90 backdrop-blur-md border-b border-sidebar-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={amwLogo} alt="AMW Reports" className="h-7 w-auto" />
            <span className="text-xs tracking-[0.25em] text-amw-offwhite/60 uppercase font-body">Reports</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-body font-medium transition-colors ${
                  location.pathname === to
                    ? 'text-primary'
                    : 'text-amw-offwhite/70 hover:text-amw-offwhite'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" asChild className="text-amw-offwhite/80 hover:text-amw-offwhite hover:bg-sidebar-accent/50">
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link to="/login?view=signup">Get Started Free</Link>
            </Button>
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
        <div className="md:hidden bg-amw-black border-t border-sidebar-border/50 px-4 pb-4 space-y-3">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm font-body font-medium ${
                location.pathname === to ? 'text-primary' : 'text-amw-offwhite/70'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" asChild className="w-full border-sidebar-border text-amw-offwhite">
              <Link to="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
            </Button>
            <Button asChild className="w-full">
              <Link to="/login?view=signup" onClick={() => setMobileOpen(false)}>Get Started Free</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default PublicNavbar;
