import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowLeft, Loader2, Sparkles,
  Palette, Building2, Users, BarChart3, Clock,
  Heart, Search, Share2, Calendar, MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LOGOS, PLATFORM_LABELS, type PlatformType } from '@/types/database';

/* ─── Constants ──────────────────────────────────────────── */

const TOTAL_STEPS = 6;

const PLATFORM_IDS: PlatformType[] = [
  'google_ads', 'meta_ads', 'facebook', 'instagram', 'tiktok',
  'linkedin', 'google_search_console', 'google_analytics',
  'google_business_profile', 'youtube',
];

const ACCOUNT_TYPES = [
  { id: 'creator', label: 'Creator', description: 'I manage my own brand and content', icon: Palette },
  { id: 'business', label: 'Business', description: 'I run a business and need marketing insights', icon: Building2 },
  { id: 'agency', label: 'Agency', description: 'I manage marketing for multiple clients', icon: Users },
];

const REASONS = [
  { id: 'time_saving', label: 'Save time on reporting', icon: Clock },
  { id: 'client_retention', label: 'Impress clients with branded reports', icon: Heart },
  { id: 'reporting', label: 'Track performance across platforms', icon: BarChart3 },
  { id: 'growth', label: 'Retain and grow client base', icon: Sparkles },
];

const REFERRAL_SOURCES = [
  { id: 'google', label: 'Google search', icon: Search },
  { id: 'social', label: 'Social media', icon: Share2 },
  { id: 'referral', label: 'Referral', icon: MessageSquare },
  { id: 'event', label: 'Event / conference', icon: Calendar },
  { id: 'other', label: 'Other', icon: MessageSquare },
];

const CLIENT_COUNTS = ['1–5', '6–20', '21–50', '50+'];

/* ─── Shared style helpers ───────────────────────────────── */

const CARD_BASE =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md hover:border-border';

const CARD_SELECTED =
  'bg-primary/8 border-primary/30 shadow-lg shadow-primary/10 scale-[1.02] ring-1 ring-primary/20';

/* ─── Page ───────────────────────────────────────────────── */

const OnboardingPage = () => {
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

  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (step === TOTAL_STEPS) {
      const colors = [
        'hsl(295, 60%, 47%)',
        'hsl(212, 64%, 59%)',
        'hsl(148, 60%, 57%)',
        'hsl(27, 84%, 57%)',
      ];
      setParticles(
        Array.from({ length: 40 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
        }))
      );
    }
  }, [step]);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';

  /* Visible step count (skip step 3 for non-agency) */
  const visibleSteps = accountType === 'agency' ? TOTAL_STEPS : TOTAL_STEPS - 1;
  const currentVisibleStep = (() => {
    if (accountType === 'agency') return step;
    if (step <= 2) return step;
    // steps 4,5,6 map to 3,4,5 for non-agency
    return step - 1;
  })();

  const goNext = () => {
    setDirection('forward');
    let next = step + 1;
    if (next === 3 && accountType !== 'agency') next = 4;
    setStep(next);
  };

  const goBack = () => {
    setDirection('back');
    let prev = step - 1;
    if (prev === 3 && accountType !== 'agency') prev = 2;
    setStep(prev);
  };

  const canContinue = () => {
    switch (step) {
      case 1: return !!accountType;
      case 2: return platformsUsed.length > 0;
      case 3: return !!clientCount;
      case 4: return !!primaryReason;
      case 5: return !!referralSource && (referralSource !== 'other' || otherReferral.trim().length > 0);
      default: return true;
    }
  };

  const togglePlatform = (id: string) => {
    setPlatformsUsed(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleComplete = async (guided: boolean) => {
    if (!user) return;
    setIsSubmitting(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    const orgId = profile?.org_id;
    if (!orgId) {
      toast.error('Organisation not found. Please contact support.');
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('onboarding_responses').insert({
      user_id: user.id,
      org_id: orgId,
      account_type: accountType,
      platforms_used: platformsUsed,
      client_count: accountType === 'agency' ? clientCount : null,
      primary_reason: primaryReason,
      referral_source: referralSource === 'other' ? `other: ${otherReferral}` : referralSource,
    });

    if (insertError) {
      console.error('Failed to save onboarding:', insertError);
      toast.error('Failed to save your preferences');
      setIsSubmitting(false);
      return;
    }

    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', user.id);

    navigate(guided ? '/dashboard?guided=true' : '/dashboard');
  };

  const progressPercent = Math.min((step / TOTAL_STEPS) * 100, 100);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient glow — subtle, behind content */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/6 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-120px] right-[-80px] w-[350px] h-[350px] rounded-full bg-secondary/5 blur-[120px] pointer-events-none" />

      {/* Centered shell */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Progress header — inside shell, not fixed */}
        {step < TOTAL_STEPS && (
          <div className="w-full max-w-xl mb-10 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Step {currentVisibleStep} of {visibleSteps - 1}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5 bg-muted" />
          </div>
        )}

        {/* Step content */}
        <div
          key={step}
          className={cn(
            'w-full max-w-xl',
            direction === 'forward' ? 'animate-fade-in' : 'animate-fade-in'
          )}
        >
          {/* Step 1: Account Type */}
          {step === 1 && (
            <StepContainer
              title="How would you describe yourself?"
              subtitle="This helps us tailor your experience"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {ACCOUNT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = accountType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setAccountType(type.id)}
                      className={cn(
                        CARD_BASE,
                        'flex flex-col items-center gap-4 p-6',
                        selected && CARD_SELECTED
                      )}
                    >
                      <div className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-300',
                        selected
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-base text-foreground">{type.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <StepActions onNext={goNext} canContinue={canContinue()} />
            </StepContainer>
          )}

          {/* Step 2: Platforms */}
          {step === 2 && (
            <StepContainer
              title="Which platforms do you use?"
              subtitle="Select all that apply — you can change these later"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PLATFORM_IDS.map((platformId) => {
                  const selected = platformsUsed.includes(platformId);
                  return (
                    <button
                      key={platformId}
                      onClick={() => togglePlatform(platformId)}
                      className={cn(
                        CARD_BASE,
                        'flex flex-col items-center gap-3 p-4',
                        selected && CARD_SELECTED
                      )}
                    >
                      <img
                        src={PLATFORM_LOGOS[platformId]}
                        alt={PLATFORM_LABELS[platformId]}
                        className="h-8 w-8 object-contain"
                      />
                      <span className="text-xs font-medium text-center leading-tight text-muted-foreground">
                        {PLATFORM_LABELS[platformId]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {/* Step 3: Client Count (agency only) */}
          {step === 3 && (
            <StepContainer
              title="How many clients do you manage?"
              subtitle="This helps us recommend the right plan"
            >
              <div className="flex flex-wrap justify-center gap-4">
                {CLIENT_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setClientCount(count)}
                    className={cn(
                      'rounded-full px-8 py-3.5 text-sm font-semibold border border-border/60 bg-card shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md',
                      clientCount === count
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 border-primary/30 scale-[1.05]'
                        : 'text-foreground hover:border-border'
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {/* Step 4: Primary Reason */}
          {step === 4 && (
            <StepContainer
              title="What's your main reason for using AMW Reports?"
              subtitle="Choose the one that matters most"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {REASONS.map((reason) => {
                  const Icon = reason.icon;
                  const selected = primaryReason === reason.id;
                  return (
                    <button
                      key={reason.id}
                      onClick={() => setPrimaryReason(reason.id)}
                      className={cn(
                        CARD_BASE,
                        'flex items-center gap-4 p-5 text-left',
                        selected && CARD_SELECTED
                      )}
                    >
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                        selected
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{reason.label}</span>
                    </button>
                  );
                })}
              </div>
              <StepActions onNext={goNext} onBack={goBack} canContinue={canContinue()} />
            </StepContainer>
          )}

          {/* Step 5: Referral Source */}
          {step === 5 && (
            <StepContainer
              title="How did you find AMW Reports?"
              subtitle="We'd love to know what brought you here"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {REFERRAL_SOURCES.map((source) => {
                  const Icon = source.icon;
                  const selected = referralSource === source.id;
                  return (
                    <button
                      key={source.id}
                      onClick={() => setReferralSource(source.id)}
                      className={cn(
                        CARD_BASE,
                        'flex flex-col items-center gap-3 p-5',
                        selected && CARD_SELECTED
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5 transition-colors duration-300',
                        selected ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className="text-sm font-medium text-foreground">{source.label}</span>
                    </button>
                  );
                })}
              </div>
              {referralSource === 'other' && (
                <div className="mt-4">
                  <Input
                    value={otherReferral}
                    onChange={(e) => setOtherReferral(e.target.value)}
                    placeholder="Tell us more..."
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/30"
                  />
                </div>
              )}
              <StepActions
                onNext={() => { setDirection('forward'); setStep(TOTAL_STEPS); }}
                onBack={goBack}
                canContinue={canContinue()}
                nextLabel="Complete"
              />
            </StepContainer>
          )}

          {/* Step 6: Welcome / Completion */}
          {step === TOTAL_STEPS && (
            <div className="flex flex-col items-center text-center space-y-8">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="fixed pointer-events-none"
                  style={{
                    left: `${p.x}%`,
                    top: '-10px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    animation: `confetti-fall 3s ${p.delay}s ease-in forwards`,
                    opacity: 0,
                  }}
                />
              ))}

              <div className="animate-scale-in space-y-6">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-body, Montserrat), sans-serif', textTransform: 'none', letterSpacing: '0' }}>
                    Welcome, {firstName}!
                  </h1>
                  <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Your workspace is ready. Let's get you set up with your first client and connections.
                  </p>
                </div>

                {/* What happens next */}
                <div className="w-full max-w-sm mx-auto rounded-xl border border-border/60 bg-card p-5 text-left space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What happens next</p>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>Add your first client</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>Connect their marketing platforms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>Generate your first branded report</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
                <Button
                  onClick={() => handleComplete(true)}
                  disabled={isSubmitting}
                  className="flex-1 h-12 text-sm gap-2 shadow-md shadow-primary/15"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Guide me through setup
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleComplete(false)}
                  disabled={isSubmitting}
                  className="flex-1 h-12 text-sm border-border text-foreground hover:bg-muted"
                >
                  I'll explore on my own
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
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

function StepContainer({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
          style={{ fontFamily: 'var(--font-body, Montserrat), sans-serif' }}
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function StepActions({
  onNext,
  onBack,
  canContinue,
  nextLabel = 'Continue',
}: {
  onNext: () => void;
  onBack?: () => void;
  canContinue: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-8">
      {onBack ? (
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      ) : (
        <div />
      )}
      <Button
        onClick={onNext}
        disabled={!canContinue}
        className="gap-2 px-8 shadow-md shadow-primary/15"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default OnboardingPage;
