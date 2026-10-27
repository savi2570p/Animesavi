import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Play, Sparkles, ArrowLeft, Mail, ShieldAlert, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { getSavedAccountCount, setSavedAccounts } from '@/lib/accountUtils';
import logo from '@/assets/logo.png';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string }>({});
  const [accountLimitReached, setAccountLimitReached] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'none' | 'active' | 'expired'>('none');
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);

  const MAX_ACCOUNTS_REGULAR = 5;

  useEffect(() => {
    if (user) {
      navigate('/');
    }
    const savedCount = getSavedAccountCount();
    setAccountLimitReached(savedCount >= MAX_ACCOUNTS_REGULAR);

    // Check localStorage token status
    const expiresStr = localStorage.getItem('unlock_token_expires');
    if (expiresStr) {
      const exp = parseInt(expiresStr, 10);
      if (Date.now() < exp) {
        setTokenStatus('active');
      } else {
        setTokenStatus('expired');
        setShowExpiredPopup(true);
      }
    }
  }, [user, navigate]);

  const validateForm = (isSignUp: boolean) => {
    try {
      if (isSignUp) {
        authSchema.parse({ email, password, username: username || undefined });
      } else {
        authSchema.omit({ username: true }).parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setIsLoading(true);
    
    // If remember me is checked, we'll store a flag in localStorage
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
      });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, username);
    setIsLoading(false);

    if (error) {
      const message = error.message.includes('already registered')
        ? 'This email is already registered. Please sign in instead.'
        : error.message;
      
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: message,
      });
    } else {
      toast({
        title: 'Account created',
        description: 'Welcome to AnimeSavi!',
      });
      navigate('/');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: { prompt: 'select_account' },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Google Sign In Failed',
          description: result.error.message || 'Could not start Google sign-in.',
        });
      }
      // If result.redirected, the browser navigates to Google.
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initiate Google sign in',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('apple', {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Apple Sign In Failed',
          description: result.error.message || 'Could not start Apple sign-in.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initiate Apple sign in',
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address',
      });
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsResetting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Password Reset Failed',
        description: error.message,
      });
    } else {
      toast({
        title: 'Check Your Email',
        description: 'We sent you a password reset link. Check your inbox.',
      });
      setShowForgotPassword(false);
      setResetEmail('');
    }
  };

  const handleGoBack = () => {
    if (showForgotPassword) {
      setShowForgotPassword(false);
      return;
    }
    navigate(-1);
  };

  return (
    <div className="auth-v8 relative min-h-screen overflow-x-hidden overflow-y-visible bg-background flex items-center justify-center py-20">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleGoBack}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="auth-layout-v8 relative z-10 w-full max-w-md px-5">
        <header className="auth-brand-v8 text-center mb-7">
          <img src={logo} alt="AnimeSavi logo" className="w-14 h-14 object-contain mx-auto mb-4 rounded-lg" />
          <h1 className="text-3xl font-heading font-bold text-foreground">AnimeSavi</h1>
          <p className="text-xs text-muted-foreground mt-2">Your next episode awaits.</p>
        </header>

        <Card className="auth-panel-v8 utility-glass-v6">
          <CardHeader className="text-left pb-5">
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {showForgotPassword ? 'Reset password' : 'Welcome back'}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {showForgotPassword
                ? 'Receive a password reset link by email.'
                : 'Sign in or create your AnimeSavi account.'
              }
            </CardDescription>

            {/* Token Status Indicator */}
            {tokenStatus === 'active' && (
              <div className="auth-token-v8 flex items-center gap-2 px-3 py-2 rounded-md mt-3">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">You have active token access</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="bg-muted/50 border-border/50 focus:border-primary"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-md"
                  disabled={isResetting}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isResetting ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Back to Sign In
                </Button>
              </form>
            ) : (
            <Tabs defaultValue={new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin'} className="w-full">
              <TabsList className="auth-tabs-v8 grid w-full grid-cols-2 mb-5 bg-muted">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted/50 border-border/50 focus:border-primary"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button variant="link" size="sm" type="button" onClick={() => setShowForgotPassword(true)} className="text-[11px] h-auto min-h-0 p-0">
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-muted/50 border-border/50 focus:border-primary"
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember-me" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label 
                      htmlFor="remember-me" 
                      className="text-sm font-normal text-muted-foreground cursor-pointer"
                    >
                      Remember me for 30 days
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-md"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-md"
                    onClick={handleAppleSignIn}
                    disabled={isAppleLoading}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 384 512" fill="currentColor">
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                    </svg>
                    {isAppleLoading ? 'Connecting...' : 'Continue with Apple ID'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {accountLimitReached ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="p-3 rounded-full bg-destructive/10">
                      <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Account Limit Reached</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      You already have {MAX_ACCOUNTS_REGULAR} accounts saved on this device. Remove an existing account from the Account Switcher to add a new one.
                    </p>
                  </div>
                ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="AnimeWatcher123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-muted/50 border-border/50 focus:border-primary"
                    />
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted/50 border-border/50 focus:border-primary"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-muted/50 border-border/50 focus:border-primary"
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-md"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
                  </Button>
                </form>
                )}
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Reset Saved Accounts Button */}
        <div className="flex flex-col items-center gap-2 mt-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              setSavedAccounts([]);
              setAccountLimitReached(false);
              toast({
                title: 'Saved accounts cleared',
                description: 'All saved account data on this device has been reset.',
              });
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset saved accounts on this device
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Expired Token Popup */}
      {showExpiredPopup && (
        <div className="utility-overlay-v6 fixed inset-0 z-[100] flex items-center justify-center p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="auth-expired-title" className="utility-glass-v6 w-full max-w-sm p-6 space-y-5">
            <div className="text-center">
              <div className="utility-icon-v6 mx-auto w-11 h-11 rounded-lg grid place-items-center mb-4 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
              <h2 id="auth-expired-title" className="text-lg font-bold mb-2">Token expired</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">Your token has expired. Please activate a new token to continue watching anime.</p>
            </div>
            <Button className="w-full" onClick={() => setShowExpiredPopup(false)}>OK</Button>
          </section>
        </div>
      )}
    </div>
  );
}
