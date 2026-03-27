import { useEffect } from 'react';
import { useOrg } from '@/contexts/OrgContext';

const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2?';

/** Dynamically load a Google Font if not already loaded */
const loadGoogleFont = (fontName: string) => {
  const id = `gfont-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `${GOOGLE_FONTS_BASE}family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
};

const BrandingProvider = ({ children }: { children: React.ReactNode }) => {
  const { org } = useOrg();

  useEffect(() => {
    const root = document.documentElement;

    if (!org) return;

    // Apply colors (stored as HSL strings like "295 60% 47%")
    if (org.primary_color) {
      root.style.setProperty('--primary', org.primary_color);
      root.style.setProperty('--ring', org.primary_color);
      root.style.setProperty('--amw-purple', org.primary_color);
      // Sidebar primary
      root.style.setProperty('--sidebar-primary', org.primary_color);
    }

    if (org.secondary_color) {
      root.style.setProperty('--secondary', org.secondary_color);
      root.style.setProperty('--amw-blue', org.secondary_color);
    }

    if (org.accent_color) {
      root.style.setProperty('--accent', org.accent_color);
      root.style.setProperty('--amw-green', org.accent_color);
      root.style.setProperty('--success', org.accent_color);
    }

    // Apply fonts
    if (org.heading_font) {
      loadGoogleFont(org.heading_font);
      root.style.setProperty('--font-heading', `"${org.heading_font}", sans-serif`);
      root.style.setProperty('--font-display', `"${org.heading_font}", sans-serif`);
    }

    if (org.body_font) {
      loadGoogleFont(org.body_font);
      root.style.setProperty('--font-body', `"${org.body_font}", sans-serif`);
    }

    return () => {
      // Clean up on unmount (e.g. logout)
      const props = [
        '--primary', '--ring', '--amw-purple', '--sidebar-primary',
        '--secondary', '--amw-blue',
        '--accent', '--amw-green', '--success',
        '--font-heading', '--font-display', '--font-body',
      ];
      props.forEach(p => root.style.removeProperty(p));
    };
  }, [org]);

  return <>{children}</>;
};

export default BrandingProvider;
