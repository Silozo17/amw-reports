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

const TOTAL_STEPS = 6; // 5 questions + 1 welcome

interface PlatformOption {
  id: string;
  label: string;
  icon: string;
}

const PLATFORMS: PlatformOption[] = [
  { id: 'google_ads', label: 'Google Ads', icon: '📊' },
  { id: 'meta_ads', label: 'Meta Ads', icon: '📢' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'google_search_console', label: 'Search Console', icon: '🔍' },
  { id: 'google_analytics', label: 'Google Analytics', icon: '📈' },
  { id: 'google_business_profile', label: 'Google Business', icon: '📍' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
];

const ACCOUNT_TYPES = [
  {
    id: 'creator',
    label: 'Creator',
    description: 'I manage my own brand and content',
    icon: Palette,
  },
  {
    id: 'business',
    label: 'Business',
    description: 'I run a business and need marketing insights',
    icon: Building2,
  },
  {
    id: 'agency',
    label: 'Agency',
    description: 'I manage marketing for multiple clients',
    icon: Users,
  },
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

  // Form state
  const [accountType, setAccountType] = useState('');
  const [platformsUsed, setPlatformsUsed] = useState<string[]>([]);
  const [clientCount, setClientCount] = useState('');
  const [primaryReason, setPrimaryReason] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [otherReferral, setOtherReferral] = useState('');

  // Confetti particles for welcome screen
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (step === TOTAL_STEPS) {
      const colors = [
        'hsl(295, 60%, 47%)', // primary/purple
        'hsl(212, 64%, 59%)', // secondary/blue
        'hsl(148, 60%, 57%)', // accent/green
        'hsl(27, 84%, 57%)',  // orange
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

  // Skip step 3 (client count) if not agency
  const getEffectiveStep = (s: number) => {
    if (s === 3 && accountType !== 'agency') return 4;
    return s;
  };

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

    // Get user's org_id
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

    // Insert onboarding responses
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

    // Mark onboarding as completed
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
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-sidebar-border">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Ambient glow */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

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
                        'group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all duration-200',
                        'hover:border-primary/50 hover:bg-primary/5',
                        selected
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                          : 'border-sidebar-border bg-sidebar-accent/30'
                      )}
                    >
                      <div className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-sidebar-border text-sidebar-foreground'
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-heading text-lg">{type.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{type.description}</p>
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
                {PLATFORMS.map((p) => {
                  const selected = platformsUsed.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200',
                        'hover:border-primary/50',
                        selected
                          ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                          : 'border-sidebar-border bg-sidebar-accent/30'
                      )}
                    >
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-xs font-medium text-center leading-tight">{p.label}</span>
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
              <div className="flex flex-wrap justify-center gap-3">
                {CLIENT_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setClientCount(count)}
                    className={cn(
                      'rounded-full border-2 px-8 py-3 text-sm font-medium transition-all duration-200',
                      'hover:border-primary/50',
                      clientCount === count
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground'
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
                        'flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200',
                        'hover:border-primary/50',
                        selected
                          ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                          : 'border-sidebar-border bg-sidebar-accent/30'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-sidebar-border text-sidebar-foreground'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{reason.label}</span>
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
                        'flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all duration-200',
                        'hover:border-primary/50',
                        selected
                          ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                          : 'border-sidebar-border bg-sidebar-accent/30'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="text-sm font-medium">{source.label}</span>
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
                    className="bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-muted-foreground"
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
              {/* Confetti particles */}
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
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/20 mb-6">
                  <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <h1 className="text-4xl font-heading tracking-wide sm:text-5xl">
                  Welcome, {firstName}!
                </h1>
                <p className="mt-4 text-lg text-muted-foreground font-body max-w-md mx-auto">
                  Your workspace is ready. Let's get you set up with your first client and connections.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                <Button
                  onClick={() => handleComplete(true)}
                  disabled={isSubmitting}
                  className="flex-1 h-14 text-base gap-2 bg-primary hover:bg-primary/90"
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
                  className="flex-1 h-14 text-base border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  I'll explore on my own
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confetti keyframes */}
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
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-heading tracking-wide sm:text-4xl">{title}</h2>
        <p className="text-muted-foreground font-body">{subtitle}</p>
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
    <div className="flex items-center justify-between pt-6">
      {onBack ? (
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-sidebar-foreground hover:bg-sidebar-accent/50 gap-2"
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
        className="gap-2 px-8"
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default OnboardingPage;
