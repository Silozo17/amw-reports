import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import LandingHero from '@/components/landing/LandingHero';

type View = 'login' | 'signup' | 'otp';

const LandingPage = () => {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'signup' ? 'signup' : 'login';
  const [view, setView] = useState<View>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'signup') setView('signup');
  }, [searchParams]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (signupPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!companyName.trim()) { toast.error('Company name is required'); return; }

    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          phone,
          company_name: companyName,
        },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for a verification code');
      setView('otp');
    }
    setIsLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setIsLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: signupEmail,
      token: otpCode,
      type: 'signup',
    });

    if (error) { toast.error(error.message); setIsLoading(false); return; }

    // Org, membership, and starter plan are created automatically by the
    // handle_new_user database trigger — no client-side writes needed.

    toast.success('Account verified! Welcome aboard.');
    navigate('/onboarding');
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: signupEmail });
    if (error) toast.error(error.message);
    else toast.success('Verification code resent');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: Auth Forms */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-heading tracking-wide text-primary">AMW</h1>
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase font-body">Reports</p>
          </div>

          {view === 'login' && (
            <>
              <div>
                <h2 className="text-2xl font-heading">Welcome back</h2>
                <p className="text-muted-foreground font-body mt-1">Sign in to your account</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@agency.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in...</> : <>Sign In <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground font-body">
                Don't have an account?{' '}
                <button onClick={() => setView('signup')} className="text-primary font-medium hover:underline">Create one</button>
              </p>
            </>
          )}

          {view === 'signup' && (
            <>
              <div>
                <h2 className="text-2xl font-heading">Create your account</h2>
                <p className="text-muted-foreground font-body mt-1">Set up your organisation in minutes</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name *</Label>
                    <Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name *</Label>
                    <Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input id="signup-email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="you@agency.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7911 123456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company / Organisation *</Label>
                  <Input id="company" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Agency Name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input id="signup-password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="Min. 8 characters" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password *</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating account...</> : <>Create Account <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground font-body">
                Already have an account?{' '}
                <button onClick={() => setView('login')} className="text-primary font-medium hover:underline">Sign in</button>
              </p>
            </>
          )}

          {view === 'otp' && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-heading">Verify your email</h2>
                <p className="text-muted-foreground font-body mt-1">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{signupEmail}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button onClick={handleVerifyOtp} className="w-full" disabled={isLoading || otpCode.length !== 6}>
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : 'Verify & Continue'}
              </Button>
              <p className="text-sm text-muted-foreground font-body">
                Didn't receive the code?{' '}
                <button onClick={handleResendOtp} className="text-primary font-medium hover:underline">Resend</button>
              </p>
            </div>
          )}
        </div>

        <footer role="contentinfo" className="w-full max-w-md mx-auto mt-8 space-y-2 text-left">
          <p className="text-xs text-foreground/60 font-body leading-relaxed">
            AMW Reports is operated by{' '}
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" aria-label="Visit AMW Media website" className="text-foreground/80 hover:text-primary transition-colors underline">AMW Media</a>.
          </p>
          <p className="text-xs text-foreground/50 font-body">
            © {new Date().getFullYear()} AMW Reports. All rights reserved.
          </p>
          <div className="flex items-center gap-3 text-xs font-body">
            <a href="https://amwmedia.co.uk/privacy-policy" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Privacy Policy" className="text-foreground/60 hover:text-primary transition-colors">Privacy Policy</a>
            <span className="text-foreground/30" aria-hidden="true">·</span>
            <a href="https://amwmedia.co.uk/terms-and-conditions" target="_blank" rel="noopener noreferrer" aria-label="AMW Reports Terms and Conditions" className="text-foreground/60 hover:text-primary transition-colors">Terms &amp; Conditions</a>
            <span className="text-foreground/30" aria-hidden="true">·</span>
            <a href="https://amwmedia.co.uk" target="_blank" rel="noopener noreferrer" aria-label="AMW Media website" className="text-foreground/60 hover:text-primary transition-colors">amwmedia.co.uk</a>
          </div>
        </footer>
      </div>

      {/* Right: Dark Hero */}
      <div className="hidden lg:block lg:w-1/2">
        <LandingHero />
      </div>
    </div>
  );
};

export default LandingPage;
