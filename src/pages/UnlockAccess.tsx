import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Shield } from 'lucide-react';

export default function UnlockAccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Mask the token from the URL immediately
    window.history.replaceState(null, '', '/unlock/verifying');

    if (!token) {
      setStatus('error');
      setErrorMsg('No unlock token provided.');
      return;
    }

    verifyToken(token);
  }, []);

  const verifyToken = async (slug: string) => {
    try {
      // Look up the single unlock token by its slug
      const { data, error } = await supabase
        .from('unlock_tokens')
        .select('*')
        .eq('token', slug)
        .eq('is_active', true)
        .neq('token', '__system_toggle__')
        .maybeSingle();

      if (error || !data) {
        setStatus('error');
        setErrorMsg('Invalid or disabled unlock link.');
        return;
      }

      // Record usage
      await supabase.from('token_usage').insert({
        token_id: data.id,
        user_agent: navigator.userAgent,
      });

      // Grant 24-hour access
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem('unlock_token_expires', expiresAt.toString());
      localStorage.setItem('unlock_token_id', data.id);

      setStatus('success');
      setTimeout(() => navigate('/'), 2000);
    } catch {
      setStatus('error');
      setErrorMsg('Verification failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      {/* Spinner */}
      {status === 'verifying' && (
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div
            className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-b-primary/50 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
        </div>
      )}

      {status === 'verifying' && (
        <>
          <Shield className="h-8 w-8 text-primary mb-4" />
          <h2 className="text-xl font-bold text-primary mb-2">Verifying Access…</h2>
          <p className="text-muted-foreground">Please wait while we validate your link.</p>
        </>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-green-500 mb-2">Access Activated!</h2>
          <p className="text-muted-foreground mb-1">You now have <span className="font-bold text-foreground">24 hours</span> of full access.</p>
          <p className="text-sm text-muted-foreground">Redirecting to homepage…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <XCircle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold text-destructive mb-2">Verification Failed</h2>
          <p className="text-muted-foreground mb-6">{errorMsg}</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary underline hover:no-underline"
          >
            Go to Homepage
          </button>
        </div>
      )}
    </div>
  );
}
