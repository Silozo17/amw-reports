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

/** Given an HSL string like "295 60% 47%", return a contrasting foreground HSL */
const computeForeground = (hsl: string): string => {
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return '0 0% 100%';
  const lightness = parseFloat(parts[2]);
  return lightness >= 55 ? '340 7% 13%' : '0 0% 100%';
};

const BrandingProvider = ({ children }: { children: React.ReactNode }) => {
  const { org } = useOrg();

  useEffect(() => {
    const root = document.documentElement;

    if (!org) return;

    // Apply colors (stored as HSL strings like "295 60% 47%")
    if (org.primary_color) {
      root.style.setProperty('--primary', org.primary_color);
      root.style.setProperty('--primary-foreground', computeForeground(org.primary_color));
      root.style.setProperty('--ring', org.primary_color);
      root.style.setProperty('--amw-purple', org.primary_color);
      root.style.setProperty('--sidebar-primary', org.primary_color);
      root.style.setProperty('--sidebar-primary-foreground', computeForeground(org.primary_color));
    }

    if (org.secondary_color) {
      root.style.setProperty('--secondary', org.secondary_color);
      root.style.setProperty('--secondary-foreground', computeForeground(org.secondary_color));
      root.style.setProperty('--amw-blue', org.secondary_color);
    }

    if (org.accent_color) {
      root.style.setProperty('--accent', org.accent_color);
      root.style.setProperty('--accent-foreground', computeForeground(org.accent_color));
      root.style.setProperty('--amw-green', org.accent_color);
      root.style.setProperty('--success', org.accent_color);
      root.style.setProperty('--success-foreground', computeForeground(org.accent_color));
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
      const props = [
        '--primary', '--primary-foreground', '--ring', '--amw-purple',
        '--sidebar-primary', '--sidebar-primary-foreground',
        '--secondary', '--secondary-foreground', '--amw-blue',
        '--accent', '--accent-foreground', '--amw-green',
        '--success', '--success-foreground',
        '--font-heading', '--font-display', '--font-body',
      ];
      props.forEach(p => root.style.removeProperty(p));
    };
  }, [org]);

  return <>{children}</>;
};

export default BrandingProvider;
