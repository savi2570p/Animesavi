import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function TokenVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Immediately mask the URL
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
        setErrorMsg('Invalid or expired token');
        return;
      }

      // Calculate expiration
      const expiresAt = Date.now() + (data.duration_hours as number) * 60 * 60 * 1000;
      localStorage.setItem('unlock_token_expires', expiresAt.toString());
      localStorage.setItem('unlock_token_id', data.id);

      setStatus('success');
      setTimeout(() => navigate('/'), 1500);
    } catch {
      setStatus('error');
      setErrorMsg('Verification failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      {/* Orange Spinner */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-b-orange-400/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>

      {status === 'verifying' && (
        <>
          <h2 className="text-xl font-bold text-orange-500 mb-2">Verifying Access…</h2>
          <p className="text-muted-foreground">Please Wait.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <h2 className="text-xl font-bold text-green-500 mb-2">Access Granted!</h2>
          <p className="text-muted-foreground">Redirecting to homepage…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h2 className="text-xl font-bold text-red-500 mb-2">Verification Failed</h2>
          <p className="text-muted-foreground mb-4">{errorMsg}</p>
          <button onClick={() => navigate('/')} className="text-orange-500 underline">Go to Homepage</button>
        </>
      )}
    </div>
  );
}
