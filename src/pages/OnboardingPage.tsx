import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowRight, ArrowLeft, Loader2, Sparkles,
  Palette, Building2, Users, BarChart3, Clock,
  Heart, Search, Share2, Calendar, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LOGOS, PLATFORM_LABELS, type PlatformType } from '@/types/database';

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

  const progressPercent = Math.min(((step) / TOTAL_STEPS) * 100, 100);

  return (
    <div className="min-h-screen bg-sidebar-background text-sidebar-foreground relative overflow-hidden">
      {/* Progress bar */}
      {step < TOTAL_STEPS && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-sidebar-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Ambient glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-100px] w-[400px] h-[400px] rounded-full bg-secondary/8 blur-[100px] pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div
          key={step}
          className={cn(
            'w-full max-w-2xl',
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
                        'group relative flex flex-col items-center gap-4 rounded-2xl p-6 transition-all duration-300 cursor-pointer',
                        selected
                          ? 'bg-primary/10 shadow-lg shadow-primary/15 ring-1 ring-primary/30 scale-[1.02]'
                          : 'bg-sidebar-accent/40 shadow-sm hover:shadow-md hover:bg-sidebar-accent/60'
                      )}
                    >
                      <div className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300',
                        selected
                          ? 'bg-primary/20 text-primary'
                          : 'bg-sidebar-accent/60 text-sidebar-foreground/70'
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-lg text-sidebar-foreground">{type.label}</p>
                        <p className="mt-1 text-xs text-sidebar-foreground/50 leading-relaxed">{type.description}</p>
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
                        'flex flex-col items-center gap-3 rounded-2xl p-4 transition-all duration-300 cursor-pointer',
                        selected
                          ? 'bg-primary/10 shadow-lg shadow-primary/15 ring-1 ring-primary/30 scale-[1.03]'
                          : 'bg-sidebar-accent/40 shadow-sm hover:shadow-md hover:bg-sidebar-accent/60'
                      )}
                    >
                      <img
                        src={PLATFORM_LOGOS[platformId]}
                        alt={PLATFORM_LABELS[platformId]}
                        className="h-8 w-8 object-contain"
                      />
                      <span className="text-xs font-medium text-center leading-tight text-sidebar-foreground/80">
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
                      'rounded-full px-8 py-3.5 text-sm font-semibold transition-all duration-300 cursor-pointer',
                      clientCount === count
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.05]'
                        : 'bg-sidebar-accent/40 text-sidebar-foreground/80 shadow-sm hover:shadow-md hover:bg-sidebar-accent/60'
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
                        'flex items-center gap-4 rounded-2xl p-5 text-left transition-all duration-300 cursor-pointer',
                        selected
                          ? 'bg-primary/10 shadow-lg shadow-primary/15 ring-1 ring-primary/30 scale-[1.02]'
                          : 'bg-sidebar-accent/40 shadow-sm hover:shadow-md hover:bg-sidebar-accent/60'
                      )}
                    >
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                        selected
                          ? 'bg-primary/20 text-primary'
                          : 'bg-sidebar-accent/60 text-sidebar-foreground/70'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-sidebar-foreground">{reason.label}</span>
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
                        'flex flex-col items-center gap-3 rounded-2xl p-5 transition-all duration-300 cursor-pointer',
                        selected
                          ? 'bg-primary/10 shadow-lg shadow-primary/15 ring-1 ring-primary/30 scale-[1.02]'
                          : 'bg-sidebar-accent/40 shadow-sm hover:shadow-md hover:bg-sidebar-accent/60'
                      )}
                    >
                      <Icon className={cn(
                        'h-5 w-5 transition-colors duration-300',
                        selected ? 'text-primary' : 'text-sidebar-foreground/50'
                      )} />
                      <span className="text-sm font-medium text-sidebar-foreground">{source.label}</span>
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
                    className="bg-sidebar-accent/40 border-none text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-1 focus-visible:ring-primary/30"
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

          {/* Step 6: Welcome Screen */}
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

              <div className="animate-scale-in">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 mb-6">
                  <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl text-sidebar-foreground">
                  Welcome, {firstName}!
                </h1>
                <p className="mt-4 text-lg text-sidebar-foreground/60 max-w-md mx-auto leading-relaxed">
                  Your workspace is ready. Let's get you set up with your first client and connections.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                <Button
                  onClick={() => handleComplete(true)}
                  disabled={isSubmitting}
                  className="flex-1 h-14 text-base gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Guide me through setup
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleComplete(false)}
                  disabled={isSubmitting}
                  className="flex-1 h-14 text-base border-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent/40"
                >
                  I'll explore on my own
                  <ArrowRight className="h-5 w-5 ml-2" />
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
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-sidebar-foreground">
          {title}
        </h2>
        <p className="text-sidebar-foreground/50 text-base">{subtitle}</p>
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
          className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 gap-2"
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
        className="gap-2 px-8 shadow-lg shadow-primary/20"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default OnboardingPage;
