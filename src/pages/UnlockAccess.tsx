import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Shield, Lock, Clock, Zap, Info } from 'lucide-react';

export default function UnlockAccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [durationHours, setDurationHours] = useState(24);

  useEffect(() => {
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
      const { data: rows, error } = await supabase
        .rpc('verify_unlock_token', { _token: slug });

      const data = Array.isArray(rows) ? rows[0] : null;

      if (error || !data) {
        setStatus('error');
        setErrorMsg('Invalid or disabled unlock link.');
        return;
      }

      const hours = data.duration_hours || 24;
      setDurationHours(hours);
      const durationMs = hours * 60 * 60 * 1000;
      const expiresAt = Date.now() + durationMs;
      localStorage.setItem('unlock_token_expires', expiresAt.toString());
      localStorage.setItem('unlock_token_id', data.id);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || null;

      await supabase.from('token_usage').insert({
        token_id: data.id,
        user_agent: navigator.userAgent,
        user_id: userId,
        expires_at: expiresAt,
      });

      setStatus('success');
      setTimeout(() => navigate('/'), 3000);
    } catch {
      setStatus('error');
      setErrorMsg('Verification failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-4"
      style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(180,0,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(180,0,0,0.06) 0%, transparent 50%), #0a0a0a' }}>

      <div className="w-full max-w-md rounded-2xl p-8 text-center space-y-5"
        style={{
          background: 'rgba(15,15,15,0.95)',
          border: '1px solid rgba(220,30,30,0.2)',
          boxShadow: '0 0 80px rgba(220,30,30,0.06)',
          backdropFilter: 'blur(20px)',
        }}>

        {/* ── Verifying ── */}
        {status === 'verifying' && (
          <>
            <div className="relative mx-auto w-16 h-16">
              <div className="w-16 h-16 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-b-red-500/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <Shield className="h-6 w-6 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Verifying Access…</h2>
            <p className="text-white/50 text-sm">Securely validating your unlock link</p>

            <div className="space-y-2 pt-4">
              <InfoRow icon={<Lock className="w-4 h-4" />} text="Encrypted token verification in progress" />
              <InfoRow icon={<Clock className="w-4 h-4" />} text="This usually takes a few seconds" />
              <InfoRow icon={<Shield className="w-4 h-4" />} text="Your session is protected end-to-end" />
            </div>
          </>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-green-400">Access Activated!</h2>
            <p className="text-white/60 text-sm">
              You now have <span className="font-bold text-white">{durationHours} hours</span> of full premium access.
            </p>

            <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <InfoRow icon={<Zap className="w-4 h-4 text-yellow-400" />} text="Watch unlimited anime in HD & 4K" />
              <InfoRow icon={<Shield className="w-4 h-4 text-green-400" />} text="Download episodes for offline viewing" />
              <InfoRow icon={<Clock className="w-4 h-4 text-blue-400" />} text={`Access expires in ${durationHours} hours`} />
            </div>

            <p className="text-xs text-white/30 pt-2">Redirecting to homepage…</p>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-400">Verification Failed</h2>
            <p className="text-white/50 text-sm">{errorMsg}</p>

            <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <InfoRow icon={<Info className="w-4 h-4 text-yellow-400" />} text="The link may have expired or been used" />
              <InfoRow icon={<Shield className="w-4 h-4 text-red-400" />} text="Contact an admin for a new unlock link" />
            </div>

            <button onClick={() => navigate('/')}
              className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 transition-all shadow-lg shadow-red-900/30">
              Go to Homepage
            </button>
          </div>
        )}
      </div>

      {/* Secured-by footer */}
      <p className="mt-6 text-[11px] text-white/20 text-center">
        This page is secured by <span className="text-white/40 font-medium">Shadow Toons</span> and <span className="text-white/40 font-medium">AnimeSavi</span>
      </p>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-left">
      <span className="text-white/40 shrink-0">{icon}</span>
      <p className="text-white/50 text-xs">{text}</p>
    </div>
  );
}
