import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import usePageMeta from '@/hooks/usePageMeta';

import AccountTypeStep from '@/components/onboarding/steps/AccountTypeStep';
import OrgSetupStep from '@/components/onboarding/steps/OrgSetupStep';
import PlatformsStep from '@/components/onboarding/steps/PlatformsStep';
import ClientCountStep from '@/components/onboarding/steps/ClientCountStep';
import ReasonStep from '@/components/onboarding/steps/ReasonStep';
import ReferralStep from '@/components/onboarding/steps/ReferralStep';
import CompletionStep from '@/components/onboarding/steps/CompletionStep';

const TOTAL_STEPS = 7;

const OnboardingPage = () => {
  usePageMeta({ title: 'Get Started — AMW Reports', description: 'Set up your AMW Reports account.' });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const [accountType, setAccountType] = useState('');
  const [platformsUsed, setPlatformsUsed] = useState<string[]>([]);
  const [clientCount, setClientCount] = useState('');
  const [primaryReason, setPrimaryReason] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [otherReferral, setOtherReferral] = useState('');

  // Org setup state
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgWebsite, setOrgWebsite] = useState('');
  const [isExtractingBranding, setIsExtractingBranding] = useState(false);

  // Fetch org data on mount
  useEffect(() => {
    if (!user) return;
    const fetchOrg = async () => {
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('user_id', user.id).single();
      if (!profile?.org_id) return;
      setOrgId(profile.org_id);
      const { data: org } = await supabase.from('organisations').select('name, logo_url, primary_color, secondary_color, accent_color').eq('id', profile.org_id).single();
      if (org) {
        setOrgName(org.name ?? '');
        setOrgLogoUrl(org.logo_url);
        if (org.primary_color) setPrimaryColor(org.primary_color);
        if (org.secondary_color) setSecondaryColor(org.secondary_color);
        if (org.accent_color) setAccentColor(org.accent_color);
      }
    };
    fetchOrg();
  }, [user]);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';
  const visibleSteps = accountType === 'agency' ? TOTAL_STEPS : TOTAL_STEPS - 1;
  const currentVisibleStep = (() => {
    if (accountType === 'agency') return step;
    if (step <= 3) return step;
    return step - 1;
  })();

  const saveOrgData = async () => {
    if (!orgId) return;
    let logoUrl = orgLogoUrl;
    if (orgLogoFile) {
      setIsUploadingLogo(true);
      const ext = orgLogoFile.name.split('.').pop();
      const path = `${orgId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('org-assets').upload(path, orgLogoFile, { upsert: true });
      if (uploadError) { toast.error('Failed to upload logo'); setIsUploadingLogo(false); return; }
      const { data: urlData } = supabase.storage.from('org-assets').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
      setOrgLogoUrl(logoUrl);
      setIsUploadingLogo(false);
    }
    const { error } = await supabase.from('organisations').update({ name: orgName.trim(), logo_url: logoUrl, primary_color: primaryColor, secondary_color: secondaryColor, accent_color: accentColor }).eq('id', orgId);
    if (error) { console.error('Failed to save org:', error); toast.error('Failed to save organisation details'); }
  };

  const goNext = async () => {
    if (step === 2) await saveOrgData();
    setDirection('forward');
    let next = step + 1;
    if (next === 4 && accountType !== 'agency') next = 5;
    setStep(next);
  };

  const goBack = () => {
    setDirection('back');
    let prev = step - 1;
    if (prev === 4 && accountType !== 'agency') prev = 3;
    setStep(prev);
  };

  const canContinue = () => {
    switch (step) {
      case 1: return !!accountType;
      case 2: return orgName.trim().length > 0;
      case 3: return platformsUsed.length > 0;
      case 4: return !!clientCount;
      case 5: return !!primaryReason;
      case 6: return !!referralSource && (referralSource !== 'other' || otherReferral.trim().length > 0);
      default: return true;
    }
  };

  const togglePlatform = (id: string) => {
    setPlatformsUsed(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5MB'); return; }
    setOrgLogoFile(file);
    setOrgLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => { setOrgLogoFile(null); setOrgLogoPreview(null); setOrgLogoUrl(null); };

  const handleComplete = async (guided: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    if (!orgId) { toast.error('Organisation not found. Please contact support.'); setIsSubmitting(false); return; }
    const { error: insertError } = await supabase.from('onboarding_responses').insert({
      user_id: user.id, org_id: orgId, account_type: accountType, platforms_used: platformsUsed,
      client_count: accountType === 'agency' ? clientCount : null,
      primary_reason: primaryReason,
      referral_source: referralSource === 'other' ? `other: ${otherReferral}` : referralSource,
    });
    if (insertError) { console.error('Failed to save onboarding:', insertError); toast.error('Failed to save your preferences'); setIsSubmitting(false); return; }
    await supabase.from('profiles').update({ onboarding_completed: true, account_type: accountType }).eq('user_id', user.id);
    navigate(guided ? '/dashboard?guided=true' : '/dashboard');
  };

  const progressPercent = Math.min((step / TOTAL_STEPS) * 100, 100);
  const logoDisplay = orgLogoPreview || orgLogoUrl;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/6 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-120px] right-[-80px] w-[350px] h-[350px] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {step < TOTAL_STEPS && (
          <div className="w-full max-w-xl mb-10 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Step {currentVisibleStep} of {visibleSteps - 1}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-muted" />
          </div>
        )}

        <div key={step} className={cn('w-full max-w-xl', 'animate-fade-in')}>
          {step === 1 && (
            <StepContainer title="How would you describe yourself?" subtitle="This helps us tailor your experience">
              <AccountTypeStep accountType={accountType} onSelect={setAccountType} />
              <StepActions onNext={goNext} canContinue={canContinue()} />
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer title="Set up your organisation" subtitle="Customise your brand — you can update this later in settings">
              <OrgSetupStep
                orgName={orgName} setOrgName={setOrgName}
                logoDisplay={logoDisplay} onLogoSelect={handleLogoSelect} onRemoveLogo={removeLogo}
                orgWebsite={orgWebsite} setOrgWebsite={setOrgWebsite}
                isExtractingBranding={isExtractingBranding} setIsExtractingBranding={setIsExtractingBranding}
                primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                secondaryColor={secondaryColor} setSecondaryColor={setSecondaryColor}
                accentColor={accentColor} setAccentColor={setAccentColor}
              />
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer title="Which platforms do you use?" subtitle="Select all that apply — you can change these later">
              <PlatformsStep platformsUsed={platformsUsed} onToggle={togglePlatform} />
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {step === 4 && (
            <StepContainer title="How many clients do you manage?" subtitle="This helps us recommend the right plan">
              <ClientCountStep clientCount={clientCount} onSelect={setClientCount} />
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {step === 5 && (
            <StepContainer title="What's your main reason for using AMW Reports?" subtitle="Choose the one that matters most">
              <ReasonStep primaryReason={primaryReason} onSelect={setPrimaryReason} />
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {step === 6 && (
            <StepContainer title="How did you find AMW Reports?" subtitle="We'd love to know what brought you here">
              <ReferralStep referralSource={referralSource} onSelect={setReferralSource} otherReferral={otherReferral} onOtherChange={setOtherReferral} />
              <StepActions
                onNext={() => { setDirection('forward'); setStep(TOTAL_STEPS); }}
                onBack={goBack}
                canContinue={canContinue()}
                nextLabel="Complete"
              />
            </StepContainer>
          )}

          {step === TOTAL_STEPS && (
            <CompletionStep firstName={firstName} isSubmitting={isSubmitting} onComplete={handleComplete} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

/* ─── Sub-components ─────────────────────────────────────── */

function StepContainer({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-body, Montserrat), sans-serif' }}>{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function StepActions({ onNext, onBack, canContinue, nextLabel = 'Continue' }: { onNext: () => void; onBack?: () => void; canContinue: boolean; nextLabel?: string }) {
  return (
    <div className="flex items-center justify-between pt-8">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:bg-muted gap-2">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>
      ) : <div />}
      <Button onClick={onNext} disabled={!canContinue} className="gap-2 px-8 shadow-md shadow-primary/15">
        {nextLabel}<ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default OnboardingPage;
