import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import LandingHero from '@/components/landing/LandingHero';
import usePageMeta from '@/hooks/usePageMeta';

type View = 'login' | 'signup' | 'otp' | 'magic-link';

const LandingPage = () => {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'signup' ? 'signup' : 'login';
  const [view, setView] = useState<View>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  usePageMeta({ title: 'Log In — AMW Reports', description: 'Sign in to your AMW Reports account or create a new one. Automated marketing reports for agencies.' });

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'signup') setView('signup');
  }, [searchParams]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  };

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

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: magicLinkEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/client-portal`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      setMagicLinkSent(true);
      toast.success('Check your email for a login link');
    }
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!loginEmail) { toast.error('Enter your email first'); return; }
                        const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        if (error) toast.error(error.message);
                        else toast.success('Password reset link sent — check your email');
                      }}
                      className="text-xs text-primary hover:underline font-body"
                    >
                      Forgot password?
                    </button>
                  </div>
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
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>
              <Button variant="outline" onClick={handleGoogleSignIn} className="w-full gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <button onClick={() => setView('magic-link')} className="w-full text-sm text-muted-foreground hover:text-foreground font-body transition-colors text-center">
                Client? <span className="text-primary font-medium hover:underline">Sign in with magic link</span>
              </button>
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
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>
              <Button variant="outline" onClick={handleGoogleSignIn} className="w-full gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign up with Google
              </Button>
              <div>
                <h2 className="text-2xl font-heading">Client Login</h2>
                <p className="text-muted-foreground font-body mt-1">
                  {magicLinkSent ? 'Check your email for a login link' : 'Enter your email to receive a sign-in link'}
                </p>
              </div>
              {!magicLinkSent ? (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">Email</Label>
                    <Input id="magic-email" type="email" value={magicLinkEmail} onChange={e => setMagicLinkEmail(e.target.value)} placeholder="you@company.com" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</> : <>Send Magic Link <ArrowRight className="h-4 w-4 ml-2" /></>}
                  </Button>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    We sent a login link to <span className="font-medium text-foreground">{magicLinkEmail}</span>
                  </p>
                  <Button variant="outline" onClick={() => { setMagicLinkSent(false); setMagicLinkEmail(''); }}>
                    Try a different email
                  </Button>
                </div>
              )}
              <p className="text-center text-sm text-muted-foreground font-body">
                Agency login?{' '}
                <button onClick={() => setView('login')} className="text-primary font-medium hover:underline">Sign in with password</button>
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
