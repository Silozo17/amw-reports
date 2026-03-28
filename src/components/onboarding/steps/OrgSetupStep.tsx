import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';

interface OrgSetupStepProps {
  orgName: string;
  setOrgName: (v: string) => void;
  logoDisplay: string | null;
  onLogoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  orgWebsite: string;
  setOrgWebsite: (v: string) => void;
  isExtractingBranding: boolean;
  setIsExtractingBranding: (v: boolean) => void;
  primaryColor: string;
  setPrimaryColor: (v: string) => void;
  secondaryColor: string;
  setSecondaryColor: (v: string) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
}

const OrgSetupStep = ({
  orgName, setOrgName,
  logoDisplay, onLogoSelect, onRemoveLogo,
  orgWebsite, setOrgWebsite,
  isExtractingBranding, setIsExtractingBranding,
  primaryColor, setPrimaryColor,
  secondaryColor, setSecondaryColor,
  accentColor, setAccentColor,
}: OrgSetupStepProps) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleExtractBranding = async () => {
    setIsExtractingBranding(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-branding', {
        body: { url: orgWebsite.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.primary_color) setPrimaryColor(data.primary_color);
      if (data?.secondary_color) setSecondaryColor(data.secondary_color);
      if (data?.accent_color) setAccentColor(data.accent_color);
      toast.success('Brand colours imported from your website');
    } catch (err) {
      console.error('Extract branding error:', err);
      toast.error('Could not extract branding — set colours manually below');
    } finally {
      setIsExtractingBranding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Organisation Name</Label>
        <Input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Your company or agency name"
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Logo</Label>
        <div className="flex items-center gap-4">
          {logoDisplay ? (
            <div className="relative">
              <img src={logoDisplay} alt="Organisation logo" className="h-16 w-16 rounded-xl object-contain border border-border bg-card p-1" />
              <button onClick={onRemoveLogo} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => logoInputRef.current?.click()} className={cn(CARD_BASE, 'flex items-center gap-3 px-5 py-3')}>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload logo</span>
            </button>
          )}
          {logoDisplay && (
            <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>Change</Button>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoSelect} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="flex items-center gap-2">
          <Input
            value={orgWebsite}
            onChange={(e) => setOrgWebsite(e.target.value)}
            placeholder="https://yourcompany.com"
            className="flex-1 bg-card border-border text-foreground placeholder:text-muted-foreground/60"
          />
          {orgWebsite.trim() && (
            <button type="button" onClick={handleExtractBranding} disabled={isExtractingBranding} className="text-xs text-primary hover:underline whitespace-nowrap disabled:opacity-50">
              {isExtractingBranding ? (
                <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Importing...</span>
              ) : (
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Auto-import branding</span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Brand Colours <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Primary', value: primaryColor, onChange: setPrimaryColor },
            { label: 'Secondary', value: secondaryColor, onChange: setSecondaryColor },
            { label: 'Accent', value: accentColor, onChange: setAccentColor },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 rounded-lg border border-border cursor-pointer bg-transparent" />
                <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-xs bg-card border-border font-mono" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: primaryColor }} />
          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: secondaryColor }} />
          <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </div>
  );
};

export default OrgSetupStep;
