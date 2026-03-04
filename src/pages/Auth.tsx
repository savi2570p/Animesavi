import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
        error.errors.forEach((err) => {
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
        title: '🎉 Account created + 1 Hour Free Premium!',
        description: 'Enjoy full access for 1 hour. After that, you\'ll need an unlock token to continue.',
      });
      navigate('/');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Google Sign In Failed',
          description: error.message,
        });
      }
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleGoBack}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-anime-purple/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-anime-pink/20 rounded-full blur-3xl animate-pulse animation-delay-400" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-anime-blue/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Play className="h-8 w-8 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold anime-gradient-text">
            AnimesaviinHindi
          </h1>
        </div>

        <Card className="glass-effect border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-heading flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-anime-purple" />
              {showForgotPassword ? 'Reset Password' : 'Join the Community'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {showForgotPassword 
                ? 'Enter your email to receive a password reset link'
                : 'Stream your favorite anime for free'
              }
            </CardDescription>

            {/* Token Status Indicator */}
            {tokenStatus === 'active' && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 animate-fade-in"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: 'rgb(34,197,94)' }} />
                <span className="text-sm font-medium" style={{ color: 'rgb(134,239,172)' }}>
                  You have active token access
                </span>
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
                  className="w-full anime-button"
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
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                <TabsTrigger value="signin" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
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
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot Password?
                      </button>
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
                    className="w-full anime-button"
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
                    className="w-full anime-button"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'radial-gradient(ellipse at center, rgba(180,0,0,0.15) 0%, rgba(0,0,0,0.85) 70%)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-scale-in"
            style={{
              background: 'linear-gradient(165deg, rgba(30,0,0,0.95) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(220,38,38,0.3)',
              boxShadow: '0 0 60px rgba(220,38,38,0.15), 0 25px 50px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div
                  className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.08) 100%)',
                    boxShadow: '0 0 30px rgba(245,158,11,0.2)',
                  }}
                >
                  <AlertTriangle className="h-8 w-8" style={{ color: 'rgb(251,191,36)' }} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight mb-2">Oops! Token Expired</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Your token has expired. Please activate a new token to continue watching anime.
                </p>
              </div>
              <button
                onClick={() => setShowExpiredPopup(false)}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, rgb(220,38,38) 0%, rgb(185,28,28) 100%)',
                  boxShadow: '0 0 20px rgba(220,38,38,0.3), 0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
