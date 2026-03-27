import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, Upload, Building2, AlertTriangle, Globe, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const FONT_OPTIONS = [
  'Anton', 'Inter', 'Montserrat', 'Poppins', 'Roboto', 'Open Sans',
  'Lato', 'Playfair Display', 'Raleway', 'Oswald', 'Nunito',
  'Source Sans 3', 'DM Sans', 'Space Grotesk', 'Outfit',
];

const REPORT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pl', label: 'Polish' },
  { value: 'da', label: 'Danish' },
];

/** Convert HSL string "h s% l%" to hex (for backward compat with old DB values) */
const hslToHex = (hsl: string): string => {
  const parts = hsl.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return '#b32fbf';
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r2, g2, b2;
  if (s === 0) { r2 = g2 = b2 = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
};

/** Detect if a stored value is hex or HSL — return hex either way */
const toHexDisplay = (dbValue: string | null, fallback: string): string => {
  if (!dbValue) return fallback;
  if (dbValue.startsWith('#')) return dbValue;
  // It's HSL from old data — convert to hex
  return hslToHex(dbValue);
};

/** Calculate relative luminance for contrast ratio */
const getLuminance = (hex: string): number => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;
  const [r, g, b] = [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrastRatio = (hex1: string, hex2: string): number => {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Color picker with label */
const ColorField = ({
  label,
  description,
  value,
  onChange,
  placeholder,
  onReset,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (hex: string) => void;
  placeholder?: string;
  onReset?: () => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    <p className="text-xs text-muted-foreground">{description}</p>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#000000'}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-10 rounded border border-input cursor-pointer"
      />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 font-mono text-xs max-w-[120px]"
      />
      {onReset && value && (
        <Button size="sm" variant="ghost" onClick={onReset} className="text-xs">
          Reset
        </Button>
      )}
    </div>
  </div>
);

const BrandingSection = () => {
  const { org, orgId, isOrgOwner, refetchOrg } = useOrg();
  const logoRef = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [showOrgName, setShowOrgName] = useState(true);
  const [primaryColor, setPrimaryColor] = useState('#b32fbf');
  const [secondaryColor, setSecondaryColor] = useState('#539BDB');
  const [accentColor, setAccentColor] = useState('#4ED68E');
  const [buttonColor, setButtonColor] = useState('');
  const [buttonTextColor, setButtonTextColor] = useState('');
  const [textOnDark, setTextOnDark] = useState('');
  const [textOnLight, setTextOnLight] = useState('');
  const [chartColor1, setChartColor1] = useState('');
  const [chartColor2, setChartColor2] = useState('');
  const [chartColor3, setChartColor3] = useState('');
  const [chartColor4, setChartColor4] = useState('');
  const [headingFont, setHeadingFont] = useState('Anton');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [showLogo, setShowLogo] = useState(true);
  const [showAiInsights, setShowAiInsights] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedResult, setExtractedResult] = useState<{
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    heading_font: string | null;
    body_font: string | null;
    logo_url: string | null;
    org_name: string | null;
  } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setLogoUrl(org.logo_url ?? '');
      setShowOrgName(org.show_org_name !== false);
      setPrimaryColor(toHexDisplay(org.primary_color, '#b32fbf'));
      setSecondaryColor(toHexDisplay(org.secondary_color, '#539BDB'));
      setAccentColor(toHexDisplay(org.accent_color, '#4ED68E'));
      setButtonColor(toHexDisplay(org.button_color, ''));
      setButtonTextColor(toHexDisplay(org.button_text_color, ''));
      setTextOnDark(toHexDisplay(org.text_on_dark, ''));
      setTextOnLight(toHexDisplay(org.text_on_light, ''));
      setChartColor1(toHexDisplay(org.chart_color_1, ''));
      setChartColor2(toHexDisplay(org.chart_color_2, ''));
      setChartColor3(toHexDisplay(org.chart_color_3, ''));
      setChartColor4(toHexDisplay(org.chart_color_4, ''));
      setHeadingFont(org.heading_font ?? 'Anton');
      setBodyFont(org.body_font ?? 'Inter');
      const rs = org.report_settings;
      setShowLogo(rs?.show_logo !== false);
      setShowAiInsights(rs?.show_ai_insights !== false);
    }
  }, [org]);

  if (!isOrgOwner) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setIsUploading(true);

    const ext = file.name.split('.').pop();
    const path = `logos/${orgId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('org-assets')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload logo');
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('org-assets').getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error } = await supabase
      .from('organisations')
      .update({ logo_url: url })
      .eq('id', orgId);

    if (error) {
      toast.error('Failed to save logo');
    } else {
      setLogoUrl(url);
      toast.success('Logo updated');
      refetchOrg();
    }
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setIsSaving(true);

    // Save hex values directly — no conversion
    const { error } = await supabase
      .from('organisations')
      .update({
        name: orgName.trim(),
        show_org_name: showOrgName,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,
        accent_color: accentColor || null,
        button_color: buttonColor || null,
        button_text_color: buttonTextColor || null,
        text_on_dark: textOnDark || null,
        text_on_light: textOnLight || null,
        chart_color_1: chartColor1 || null,
        chart_color_2: chartColor2 || null,
        chart_color_3: chartColor3 || null,
        chart_color_4: chartColor4 || null,
        heading_font: headingFont,
        body_font: bodyFont,
        report_settings: {
          show_logo: showLogo,
          show_ai_insights: showAiInsights,
        },
      })
      .eq('id', orgId);

    if (error) {
      toast.error('Failed to save branding');
    } else {
      toast.success('Branding updated');
      refetchOrg();
    }
    setIsSaving(false);
  };

  const handleExtractBranding = async () => {
    if (!websiteUrl.trim()) return;
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-branding', {
        body: { url: websiteUrl.trim() },
      });

      if (error) throw error;

      if (data?.success && data.branding) {
        const b = data.branding;
        if (b.colors?.primary) setPrimaryColor(b.colors.primary);
        if (b.colors?.secondary) setSecondaryColor(b.colors.secondary);
        if (b.colors?.accent) setAccentColor(b.colors.accent);
        if (b.colors?.background && b.colors.background !== '#FFFFFF' && b.colors.background !== '#ffffff') {
          // Only set text colors if they're interesting
          if (b.colors.textPrimary) setTextOnLight(b.colors.textPrimary);
        }
        if (b.typography?.fontFamilies?.heading) {
          const hf = b.typography.fontFamilies.heading;
          if (FONT_OPTIONS.includes(hf)) setHeadingFont(hf);
        }
        if (b.typography?.fontFamilies?.primary) {
          const bf = b.typography.fontFamilies.primary;
          if (FONT_OPTIONS.includes(bf)) setBodyFont(bf);
        }
        if (b.images?.logo || b.logo) {
          // Don't auto-set logo — just notify
          toast.info('Logo found — upload it manually to ensure quality');
        }
        toast.success('Branding extracted — review and save');
      } else {
        toast.error(data?.error || 'Could not extract branding from this website');
      }
    } catch (err) {
      console.error('Branding extraction error:', err);
      toast.error('Failed to extract branding. Make sure the URL is valid.');
    } finally {
      setIsExtracting(false);
    }
  };

  const effectiveButtonBg = buttonColor || primaryColor;
  const effectiveButtonText = buttonTextColor || '#ffffff';
  const contrastRatio = getContrastRatio(effectiveButtonBg, effectiveButtonText);
  const contrastWarning = contrastRatio < 4.5;

  const effectiveChart1 = chartColor1 || primaryColor;
  const effectiveChart2 = chartColor2 || secondaryColor;
  const effectiveChart3 = chartColor3 || accentColor;
  const effectiveChart4 = chartColor4 || '#EE8733';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="font-display text-lg">Branding</CardTitle>
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Identity ── */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Identity</h3>
          <div className="flex items-start gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 rounded-lg">
                <AvatarImage src={logoUrl} className="object-contain" />
                <AvatarFallback className="rounded-lg bg-muted"><Building2 className="h-8 w-8 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <button
                onClick={() => logoRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Upload className="h-5 w-5 text-white" />}
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label>Organisation Name</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Show name in sidebar</Label>
                  <p className="text-xs text-muted-foreground">When off, only the logo appears</p>
                </div>
                <Switch checked={showOrgName} onCheckedChange={setShowOrgName} />
              </div>
            </div>
          </div>

          {/* Import from website */}
          <div className="mt-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="flex-1 max-w-sm text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleExtractBranding}
              disabled={isExtracting || !websiteUrl.trim()}
              className="gap-1.5 shrink-0"
            >
              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Import branding
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">Extract colours and fonts from your website automatically</p>
        </div>

        <Separator />

        {/* ── Colours ── */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Colours</h3>
          <p className="text-xs text-muted-foreground mb-4">Define your brand palette. All colours apply across the platform and reports.</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <ColorField label="Primary" description="Headers, buttons, and key accents" value={primaryColor} onChange={setPrimaryColor} />
              <ColorField label="Secondary" description="Charts, links, and supporting elements" value={secondaryColor} onChange={setSecondaryColor} />
              <ColorField label="Accent" description="Highlights, success states, and CTAs" value={accentColor} onChange={setAccentColor} />
              <ColorField label="Button background" description="Defaults to Primary if not set" value={buttonColor} onChange={setButtonColor} placeholder="Use primary" onReset={() => setButtonColor('')} />
              <div className="space-y-1.5">
                <ColorField label="Button text" description="Auto-calculated if not set" value={buttonTextColor} onChange={setButtonTextColor} placeholder="Auto" onReset={() => setButtonTextColor('')} />
                {contrastWarning && (
                  <div className="flex items-center gap-1.5 text-destructive text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Contrast ratio {contrastRatio.toFixed(1)}:1 — below WCAG AA (4.5:1)
                  </div>
                )}
              </div>
              <ColorField label="Text on dark backgrounds" description="Text colour on primary-coloured backgrounds" value={textOnDark} onChange={setTextOnDark} placeholder="#ffffff" onReset={() => setTextOnDark('')} />
              <ColorField label="Text on light backgrounds" description="Body text on white/light backgrounds" value={textOnLight} onChange={setTextOnLight} placeholder="#1e1e1e" onReset={() => setTextOnLight('')} />
            </div>

            {/* Live preview + Chart palette below it */}
            <div className="space-y-6">
              <div>
                <Label className="text-xs text-muted-foreground block mb-2">Live Preview</Label>
                <div className="rounded-lg border p-4 space-y-4 bg-card">
                  <div className="h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <button
                    className="rounded-md px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: effectiveButtonBg, color: effectiveButtonText }}
                  >
                    Sample Button
                  </button>
                  <div className="rounded-lg border p-3" style={{ borderTopWidth: '3px', borderTopColor: primaryColor }}>
                    <p className="text-xs text-muted-foreground uppercase">Impressions</p>
                    <p className="text-xl font-bold">12,450</p>
                    <span className="text-xs" style={{ color: accentColor }}>↑ 8.3%</span>
                  </div>
                  <div className="flex items-end gap-1 h-12">
                    {[60, 80, 45, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${h}%`,
                          backgroundColor: [effectiveChart1, effectiveChart2, effectiveChart3, effectiveChart4][i],
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5 h-6">
                    <div className="flex-1 rounded" style={{ backgroundColor: primaryColor }} />
                    <div className="flex-1 rounded" style={{ backgroundColor: secondaryColor }} />
                    <div className="flex-1 rounded" style={{ backgroundColor: accentColor }} />
                  </div>
                </div>
              </div>

              {/* Chart Palette — directly below preview */}
              <div>
                <h4 className="text-sm font-semibold mb-1">Chart Palette</h4>
                <p className="text-xs text-muted-foreground mb-3">Controls all graphs and charts across the platform and in reports.</p>
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Chart 1" description="Default: Primary" value={chartColor1} onChange={setChartColor1} placeholder={primaryColor} onReset={() => setChartColor1('')} />
                  <ColorField label="Chart 2" description="Default: Secondary" value={chartColor2} onChange={setChartColor2} placeholder={secondaryColor} onReset={() => setChartColor2('')} />
                  <ColorField label="Chart 3" description="Default: Accent" value={chartColor3} onChange={setChartColor3} placeholder={accentColor} onReset={() => setChartColor3('')} />
                  <ColorField label="Chart 4" description="Default: Orange" value={chartColor4} onChange={setChartColor4} placeholder="#EE8733" onReset={() => setChartColor4('')} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Typography ── */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Typography</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heading Font</Label>
              <Select value={headingFont} onValueChange={setHeadingFont}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select value={bodyFont} onValueChange={setBodyFont}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border p-4 space-y-2 mt-4">
            <p className="text-lg" style={{ fontFamily: headingFont }}>Your Brand Name</p>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: bodyFont }}>Performance data and insights for your business.</p>
          </div>
        </div>

        <Separator />

        {/* ── Report Settings ── */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Report Settings</h3>
          <p className="text-xs text-muted-foreground mb-4">Control how generated PDF reports look. Changes apply to all future reports.</p>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Show Organisation Logo</Label>
                <p className="text-xs text-muted-foreground">Display your logo on the cover and closing pages</p>
              </div>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Include AI Insights</Label>
                <p className="text-xs text-muted-foreground">Add AI-generated platform analysis section</p>
              </div>
              <Switch checked={showAiInsights} onCheckedChange={setShowAiInsights} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BrandingSection;
