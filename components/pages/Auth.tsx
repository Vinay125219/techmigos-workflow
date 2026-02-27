import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Rocket, UserPlus, Eye, EyeOff, AlertCircle, ArrowLeft, PartyPopper, CheckCircle2, Sparkles, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { getCompanyAccessMode, getCompanyAllowedEmails } from '@/lib/company-policy';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

function resolveRedirectPath(rawPath: string | null): string {
  if (rawPath && rawPath.startsWith('/') && !rawPath.startsWith('//')) {
    return rawPath;
  }
  return '/dashboard';
}

function getFirstZodMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'Invalid input';
  }
  return 'Invalid input';
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, signInWithGoogle, isAuthenticated } = useAuth();
  const redirectTo = useMemo(() => resolveRedirectPath(searchParams.get('redirectTo')), [searchParams]);
  const oauthStatus = searchParams.get('oauth');
  const showConfirmation = searchParams.get('confirmed') === 'true';
  const queryError = oauthStatus === 'error' ? 'Google sign-in failed. Please try again.' : '';
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const sparkleParticles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        id: index,
        left: (index * 37) % 100,
        top: (index * 53 + 17) % 100,
        animationDelay: `${(index % 5) * 0.4}s`,
        animationDuration: `${3 + (index % 4) * 0.5}s`,
      })),
    []
  );
  const companyAccessMode = useMemo(() => getCompanyAccessMode(), []);
  const isAllowlistMode = companyAccessMode === 'allowlist';
  const companyAllowedEmails = useMemo(() => getCompanyAllowedEmails(), []);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const displayError = error || queryError;

  useEffect(() => {
    try {
      const pendingAuthError = window.sessionStorage.getItem('tm_auth_error');
      if (!pendingAuthError) return;
      setError(pendingAuthError);
      window.sessionStorage.removeItem('tm_auth_error');
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    if (oauthStatus === 'success' && isAuthenticated) {
      router.replace(redirectTo);
    }

    if (showConfirmation) {
      // Auto-redirect after showing celebration.
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace(redirectTo);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [oauthStatus, showConfirmation, isAuthenticated, router, redirectTo]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !showConfirmation) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, showConfirmation, router, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err: unknown) {
      setError(getFirstZodMessage(err));
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setError(error.message || 'Failed to sign in');
    } else {
      router.replace(redirectTo);
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err: unknown) {
      setError(getFirstZodMessage(err));
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please sign in.');
      } else {
        setError(error.message || 'Failed to create account');
      }
    } else {
      // Show prominent success message to check email
      toast({
        title: "✅ Account Created Successfully!",
        description: "Please check your email inbox and click the confirmation link to activate your account.",
        duration: 10000, // Show for 10 seconds
      });

      // Clear the form
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');

      // Switch to login tab after a brief delay
      setTimeout(() => {
        setTab('login');
      }, 2000);
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message || 'Failed to connect with Google');
      setIsLoading(false);
    }
  };

  // Show celebration screen when email is confirmed
  if (showConfirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background overflow-hidden">
        {/* Animated background particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {sparkleParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute animate-float"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDelay: particle.animationDelay,
                animationDuration: particle.animationDuration,
              }}
            >
              <Sparkles className="w-4 h-4 text-primary/30" />
            </div>
          ))}
        </div>

        <div className="relative z-10 text-center max-w-md">
          {/* Animated success icon */}
          <div className="relative mx-auto mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center animate-bounce shadow-2xl shadow-green-500/30">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 animate-pulse">
              <PartyPopper className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="absolute -bottom-2 -left-2 animate-pulse" style={{ animationDelay: '0.5s' }}>
              <PartyPopper className="w-8 h-8 text-pink-500 transform -scale-x-100" />
            </div>
          </div>

          {/* Celebration text */}
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent animate-pulse">
            🎉 Email Confirmed!
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Welcome to <span className="font-semibold text-foreground">TechMigos ProTask</span>!
          </p>
          <p className="text-muted-foreground mb-8">
            Your account is now active. Get ready to boost your productivity!
          </p>

          {/* Action button */}
          <Button
            size="lg"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30 animate-pulse"
            onClick={() => router.replace(redirectTo)}
          >
            <Rocket className="w-5 h-5 mr-2" />
            Start Your Journey
          </Button>

          <p className="text-sm text-muted-foreground mt-4">
            Redirecting automatically in a moment...
          </p>
        </div>

        {/* CSS for float animation */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
            50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <Card className="shadow-xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--gradient-primary)' }}>
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to TechMigos ProTask</CardTitle>
            <CardDescription>
              Sign in to manage projects, assign tasks, and collaborate with your team.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'signup'); setError(''); }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {displayError && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {displayError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                    {isAllowlistMode
                      ? 'Company policy: invite-only mode. Users must be approved by an admin before Sign Up or Google login.'
                      : 'Company policy: open mode. Everyone can sign in with Google, and admins can assign roles after login.'}
                    {isAllowlistMode && companyAllowedEmails.length > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        Approved emails: {companyAllowedEmails.join(', ')}
                      </div>
                    )}
                  </div>
                  {displayError && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {displayError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
