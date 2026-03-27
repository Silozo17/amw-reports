import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save, Loader2, Upload, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const FONT_OPTIONS = [
  'Anton', 'Inter', 'Montserrat', 'Poppins', 'Roboto', 'Open Sans',
  'Lato', 'Playfair Display', 'Raleway', 'Oswald', 'Nunito',
  'Source Sans 3', 'DM Sans', 'Space Grotesk', 'Outfit',
];

/** Convert hex (#rrggbb) to HSL string "h s% l%" */
const hexToHsl = (hex: string): string | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/** Convert HSL string "h s% l%" to hex */
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
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const BrandingSection = () => {
  const { org, orgId, isOrgOwner, refetchOrg } = useOrg();
  const logoRef = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#b32fbf');
  const [secondaryColor, setSecondaryColor] = useState('#539BDB');
  const [accentColor, setAccentColor] = useState('#4ED68E');
  const [headingFont, setHeadingFont] = useState('Anton');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
      setLogoUrl(org.logo_url ?? '');
      setPrimaryColor(org.primary_color ? hslToHex(org.primary_color) : '#b32fbf');
      setSecondaryColor(org.secondary_color ? hslToHex(org.secondary_color) : '#539BDB');
      setAccentColor(org.accent_color ? hslToHex(org.accent_color) : '#4ED68E');
      setHeadingFont(org.heading_font ?? 'Anton');
      setBodyFont(org.body_font ?? 'Inter');
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

    const { error } = await supabase
      .from('organisations')
      .update({
        name: orgName.trim(),
        primary_color: hexToHsl(primaryColor),
        secondary_color: hexToHsl(secondaryColor),
        accent_color: hexToHsl(accentColor),
        heading_font: headingFont,
        body_font: bodyFont,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Branding</CardTitle>
        <p className="text-sm text-muted-foreground">Customise your organisation's look and feel across the platform.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo & Org Name */}
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
          <div className="flex-1 space-y-2">
            <Label>Organisation Name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
        </div>

        {/* Colors */}
        <div>
          <Label className="mb-3 block">Brand Colors</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Primary</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded border border-input cursor-pointer"
                />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Secondary</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="h-10 w-10 rounded border border-input cursor-pointer"
                />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1 font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Accent</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="h-10 w-10 rounded border border-input cursor-pointer"
                />
                <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1 font-mono text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Swatch */}
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Preview</Label>
          <div className="flex gap-2 h-8">
            <div className="flex-1 rounded" style={{ backgroundColor: primaryColor }} />
            <div className="flex-1 rounded" style={{ backgroundColor: secondaryColor }} />
            <div className="flex-1 rounded" style={{ backgroundColor: accentColor }} />
          </div>
        </div>

        {/* Fonts */}
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
            <p className="text-lg" style={{ fontFamily: headingFont }}>Preview Heading</p>
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
            <p className="text-sm" style={{ fontFamily: bodyFont }}>Preview body text for your reports and dashboard.</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Branding
        </Button>
      </CardContent>
    </Card>
  );
};

export default BrandingSection;
