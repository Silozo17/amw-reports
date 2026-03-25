import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { BarChart3, FileText, Users, Palette, ArrowRight, Loader2 } from 'lucide-react';

type View = 'login' | 'signup' | 'otp';

const LandingPage = () => {
  const [view, setView] = useState<View>('login');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP state
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
    if (signupPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (signupPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }

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

    const { data, error } = await supabase.auth.verifyOtp({
      email: signupEmail,
      token: otpCode,
      type: 'signup',
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    // Create org for new user
    if (data.user) {
      const { data: orgData, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: companyName,
          slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          created_by: data.user.id,
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('Failed to create org:', orgError);
        toast.error('Account verified but failed to create organisation. Please contact support.');
        setIsLoading(false);
        return;
      }

      // Create org membership
      await supabase.from('org_members').insert({
        org_id: orgData.id,
        user_id: data.user.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
      });

      // Update profile with org_id and phone
      await supabase
        .from('profiles')
        .update({ org_id: orgData.id })
        .eq('user_id', data.user.id);
    }

    toast.success('Account verified! Welcome aboard.');
    navigate('/dashboard');
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: signupEmail,
    });
    if (error) toast.error(error.message);
    else toast.success('Verification code resent');
  };

  const FEATURES = [
    { icon: BarChart3, title: 'Multi-Platform Analytics', desc: 'Google, Meta, TikTok, LinkedIn & more — all in one place' },
    { icon: FileText, title: 'Automated Reports', desc: 'Beautiful branded PDFs generated and emailed monthly' },
    { icon: Users, title: 'Client Management', desc: 'Manage clients, recipients, and platform connections' },
    { icon: Palette, title: 'White-Label Ready', desc: 'Your brand, your logo, your colours — fully customisable' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-sidebar-background via-sidebar-background to-primary/20 text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-display tracking-wide text-primary">AMW</h1>
          <p className="text-xs tracking-[0.3em] text-sidebar-foreground/60 uppercase font-body">Reports</p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-display leading-tight">
              Automated Marketing<br />
              <span className="text-primary">Reports for Agencies</span>
            </h2>
            <p className="mt-4 text-lg text-sidebar-foreground/70 font-body max-w-md">
              Connect your marketing platforms, generate stunning branded reports, and deliver insights to your clients — automatically.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg bg-sidebar-accent/40 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-body font-semibold">{title}</p>
                  <p className="text-xs text-sidebar-foreground/60 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-sidebar-foreground/40 font-body">
          © {new Date().getFullYear()} AMW Media. All rights reserved.
        </p>
      </div>

      {/* Right: Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-display tracking-wide text-primary">AMW</h1>
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase font-body">Reports</p>
          </div>

          {view === 'login' && (
            <>
              <div>
                <h2 className="text-2xl font-display">Welcome back</h2>
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
                <button onClick={() => setView('signup')} className="text-primary font-medium hover:underline">
                  Create one
                </button>
              </p>
            </>
          )}

          {view === 'signup' && (
            <>
              <div>
                <h2 className="text-2xl font-display">Create your account</h2>
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
                <button onClick={() => setView('login')} className="text-primary font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </>
          )}

          {view === 'otp' && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-display">Verify your email</h2>
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
                <button onClick={handleResendOtp} className="text-primary font-medium hover:underline">
                  Resend
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
