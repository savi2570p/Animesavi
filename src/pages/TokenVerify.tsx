import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

export default function TokenVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [durationHours, setDurationHours] = useState<number | null>(null);

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
      const { data, error } = await supabase
        .from('unlock_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setStatus('error');
        setErrorMsg('Invalid or expired token. Please request a new one.');
        return;
      }

      const hours = data.duration_hours as number;
      const expiresAt = Date.now() + hours * 60 * 60 * 1000;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      await supabase.from('token_usage').insert({
        token_id: data.id,
        user_agent: navigator.userAgent,
        expires_at: expiresAt,
        ...(userId ? { user_id: userId } : {}),
      });

      localStorage.setItem('unlock_token_expires', expiresAt.toString());
      localStorage.setItem('unlock_token_id', data.id);

      setDurationHours(hours);
      setStatus('success');
      setTimeout(() => navigate('/'), 2500);
    } catch {
      setStatus('error');
      setErrorMsg('Verification failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 px-4">
      {/* Animated background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: status === 'success'
            ? 'radial-gradient(circle, hsl(142 76% 36% / 0.3), transparent 70%)'
            : status === 'error'
            ? 'radial-gradient(circle, hsl(0 84% 60% / 0.2), transparent 70%)'
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
      <div className="relative text-center max-w-sm">
        {status === 'verifying' && (
          <>
            <h2 className="text-xl font-bold text-primary mb-2">Verifying Access…</h2>
            <p className="text-muted-foreground text-sm">Validating your token. Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-2xl font-bold text-green-500">Access Granted!</h2>
            <p className="text-muted-foreground text-sm">Your premium access has been activated successfully.</p>
            
            {durationHours && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <Clock className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">
                  Valid for {durationHours} {durationHours === 1 ? 'hour' : 'hours'}
                </span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-primary" />
                <span>Ad-free streaming unlocked</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3 h-3 text-primary" />
                <span>All episodes & downloads available</span>
              </div>
            </div>

            <p className="text-muted-foreground/60 text-xs pt-2">Redirecting to homepage…</p>
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
