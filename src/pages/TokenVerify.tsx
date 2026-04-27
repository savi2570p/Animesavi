import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle, XCircle, Clock, Zap, Download, Globe, Users, Smartphone, Play, Star } from 'lucide-react';

export default function TokenVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    window.history.replaceState(null, '', '/secure-verify');
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('No token provided');
      return;
    }
    verifyToken(token);
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const { data: rows, error } = await supabase
        .rpc('verify_unlock_token', { _token: token });

      const data = Array.isArray(rows) ? rows[0] : null;

      if (error || !data) {
        setStatus('error');
        setErrorMsg('Invalid or expired token. Please request a new one.');
        return;
      }

      const hours = data.duration_hours as number;
      const expiry = Date.now() + hours * 60 * 60 * 1000;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      await supabase.from('token_usage').insert({
        token_id: data.id,
        user_agent: navigator.userAgent,
        expires_at: expiry,
        ...(userId ? { user_id: userId } : {}),
      });

      localStorage.setItem('unlock_token_expires', expiry.toString());
      localStorage.setItem('unlock_token_id', data.id);

      setDurationHours(hours);
      setExpiresAt(expiry);
      setStatus('success');
      setTimeout(() => navigate('/'), 3500);
    } catch {
      setStatus('error');
      setErrorMsg('Verification failed. Please try again.');
    }
  };

  const formatDuration = (hours: number) => {
    if (hours >= 720) return `${Math.round(hours / 720)} months`;
    if (hours >= 168) return `${Math.round(hours / 168)} weeks`;
    if (hours >= 24) return `${Math.round(hours / 24)} days`;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  };

  const formatExpiry = (ts: number) => {
    return new Date(ts).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const includedFeatures = [
    { icon: Zap, text: 'Ad-free streaming on all devices' },
    { icon: Play, text: 'Full access to all episodes & movies' },
    { icon: Download, text: 'Unlimited direct downloads' },
    { icon: Globe, text: 'Hindi dubbed & subbed content' },
    { icon: Smartphone, text: 'Mobile, tablet & TV optimized' },
    { icon: Users, text: 'Watch party hosting & joining' },
    { icon: Star, text: 'Early access to new releases' },
  ];

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 px-4 overflow-y-auto">
      {/* Animated background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: status === 'success'
            ? 'radial-gradient(circle, hsl(142 76% 36% / 0.3), transparent 70%)'
            : status === 'error'
            ? 'radial-gradient(circle, hsl(270 80% 65% / 0.2), transparent 70%)'
            : 'radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)',
        }}
      />

      {/* Spinner (verifying only) */}
      {status === 'verifying' && (
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-b-primary/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <Shield className="absolute inset-0 m-auto w-6 h-6 text-primary" />
        </div>
      )}

      {/* Success icon */}
      {status === 'success' && (
        <div className="mb-6 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/30">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
      )}

      {/* Error icon */}
      {status === 'error' && (
        <div className="mb-6 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center border-2 border-destructive/30">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative text-center max-w-md w-full">
        {status === 'verifying' && (
          <>
            <h2 className="text-xl font-bold text-primary mb-2">Verifying Access…</h2>
            <p className="text-muted-foreground text-sm">Validating your token. Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <div className="animate-fade-in space-y-5">
            <h2 className="text-2xl font-bold text-green-500">Access Granted!</h2>
            <p className="text-muted-foreground text-sm">Your premium access has been activated successfully.</p>
            
            {/* Duration & Expiry */}
            {durationHours && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400 font-semibold">
                    Valid for {formatDuration(durationHours)}
                  </span>
                </div>
                {expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expires: {formatExpiry(expiresAt)}
                  </p>
                )}
              </div>
            )}

            {/* What's included */}
            <div className="text-left bg-card/50 rounded-2xl border border-border/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground text-center">What's Included</p>
              <div className="space-y-2.5">
                {includedFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <f.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-muted-foreground/60 text-xs pt-1">Redirecting to homepage…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-xl font-bold text-destructive">Verification Failed</h2>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            
            <div className="space-y-2 pt-2 text-left">
              <p className="text-xs text-muted-foreground font-medium">Common reasons:</p>
              <ul className="space-y-1 text-xs text-muted-foreground/70 list-disc list-inside">
                <li>Token has already been used or expired</li>
                <li>Token link is incomplete or corrupted</li>
                <li>Token was deactivated by admin</li>
              </ul>
            </div>

            <div className="bg-card/50 rounded-xl border border-border/30 p-3 text-left mt-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">What to do:</p>
              <ul className="space-y-1 text-xs text-muted-foreground/70 list-disc list-inside">
                <li>Contact admin for a fresh token link</li>
                <li>Make sure you're using the full URL</li>
                <li>Check if your current access is still active</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/')}
              className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:scale-105 transition-all duration-200"
            >
              Go to Homepage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
