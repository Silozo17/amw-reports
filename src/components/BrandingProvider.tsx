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
const computeForeground = (hsl: string, darkDefault = '340 7% 13%', lightDefault = '0 0% 100%'): string => {
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return lightDefault;
  const lightness = parseFloat(parts[2]);
  return lightness >= 55 ? darkDefault : lightDefault;
};

/** Lighten an HSL colour string by a factor (0–1) */
const lightenHsl = (hsl: string, amount: number): string => {
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return hsl;
  const [, h, s, l] = match;
  const newL = Math.min(97, parseInt(l) + Math.round((100 - parseInt(l)) * amount));
  return `${h} ${s}% ${newL}%`;
};

const BrandingProvider = ({ children }: { children: React.ReactNode }) => {
  const { org } = useOrg();

  useEffect(() => {
    const root = document.documentElement;

    if (!org) return;

    // ── Primary ──
    if (org.primary_color) {
      const p = org.primary_color;
      root.style.setProperty('--primary', p);
      root.style.setProperty('--primary-foreground', computeForeground(p));
      root.style.setProperty('--primary-light', lightenHsl(p, 0.85));
      root.style.setProperty('--primary-mid', lightenHsl(p, 0.6));
      root.style.setProperty('--ring', p);
      root.style.setProperty('--amw-purple', p);
      root.style.setProperty('--sidebar-primary', p);
      root.style.setProperty('--sidebar-primary-foreground', computeForeground(p));
    }

    // ── Secondary ──
    if (org.secondary_color) {
      const s = org.secondary_color;
      root.style.setProperty('--secondary', s);
      root.style.setProperty('--secondary-foreground', computeForeground(s));
      root.style.setProperty('--secondary-light', lightenHsl(s, 0.85));
      root.style.setProperty('--amw-blue', s);
    }

    // ── Accent ──
    if (org.accent_color) {
      const a = org.accent_color;
      root.style.setProperty('--accent', a);
      root.style.setProperty('--accent-foreground', computeForeground(a));
      root.style.setProperty('--accent-light', lightenHsl(a, 0.85));
      root.style.setProperty('--amw-green', a);
      root.style.setProperty('--success', a);
      root.style.setProperty('--success-foreground', computeForeground(a));
    }

    // ── Button colours ──
    const buttonColor = (org as Record<string, unknown>).button_color as string | null ?? org.primary_color;
    if (buttonColor) {
      root.style.setProperty('--button-primary', buttonColor);
      root.style.setProperty('--button-primary-foreground',
        ((org as Record<string, unknown>).button_text_color as string | null) ?? computeForeground(buttonColor));
    }

    // ── Text colours ──
    const textOnDark = (org as Record<string, unknown>).text_on_dark as string | null;
    if (textOnDark) {
      root.style.setProperty('--text-on-primary', textOnDark);
    }
    const textOnLight = (org as Record<string, unknown>).text_on_light as string | null;
    if (textOnLight) {
      root.style.setProperty('--text-body', textOnLight);
    }

    // ── Chart colours ──
    const c1 = ((org as Record<string, unknown>).chart_color_1 as string | null) ?? org.primary_color;
    const c2 = ((org as Record<string, unknown>).chart_color_2 as string | null) ?? org.secondary_color;
    const c3 = ((org as Record<string, unknown>).chart_color_3 as string | null) ?? org.accent_color;
    const c4 = (org as Record<string, unknown>).chart_color_4 as string | null;
    if (c1) root.style.setProperty('--chart-1', c1);
    if (c2) root.style.setProperty('--chart-2', c2);
    if (c3) root.style.setProperty('--chart-3', c3);
    if (c4) root.style.setProperty('--chart-4', c4);

    // ── Fonts ──
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
        '--primary', '--primary-foreground', '--primary-light', '--primary-mid',
        '--ring', '--amw-purple',
        '--sidebar-primary', '--sidebar-primary-foreground',
        '--secondary', '--secondary-foreground', '--secondary-light', '--amw-blue',
        '--accent', '--accent-foreground', '--accent-light', '--amw-green',
        '--success', '--success-foreground',
        '--button-primary', '--button-primary-foreground',
        '--text-on-primary', '--text-body',
        '--chart-1', '--chart-2', '--chart-3', '--chart-4',
        '--font-heading', '--font-display', '--font-body',
      ];
      props.forEach(p => root.style.removeProperty(p));
    };
  }, [org]);

  return <>{children}</>;
};

export default BrandingProvider;
