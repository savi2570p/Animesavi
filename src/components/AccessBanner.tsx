import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const SUPER_ADMIN_EMAILS = [
  'savi2570p@gmail.com',
  'savipanjeta2@gmail.com',
];

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Always fetch token system status directly from DB via RPC — bypasses RLS */
export async function fetchTokenSystemStatus(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('get_token_system_status');
    if (error) {
      console.error('Token system status fetch error:', error);
      return true; // default enabled on error
    }
    return data ?? true;
  } catch {
    return true;
  }
}

/** Legacy sync helper — now just calls fetchTokenSystemStatus */
export async function syncTokenSystemFlag() {
  await fetchTokenSystemStatus();
}

export function hasValidTokenAccess(email?: string | null): boolean {
  if (isSuperAdmin(email)) return true;
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return false;
  return Date.now() < parseInt(expiresStr, 10);
}

/**
 * Sync token access from DB → localStorage for logged-in users.
 * This ensures access persists when the PWA is added to the home screen
 * (which may have a separate localStorage from the browser).
 */
export async function syncTokenAccessFromDB() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // Already have valid local access — nothing to sync
    if (hasValidTokenAccess()) return;

    // Check DB for an active grant for this user
    const { data } = await supabase
      .from('token_usage')
      .select('expires_at, token_id')
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.expires_at && Date.now() < Number(data.expires_at)) {
      localStorage.setItem('unlock_token_expires', data.expires_at.toString());
      localStorage.setItem('unlock_token_id', data.token_id);
    }
  } catch {
    // Silently fail — non-critical
  }
}

/** @deprecated Use fetchTokenSystemStatus + hasValidTokenAccess instead */
export function hasValidAccess(email?: string | null): boolean {
  if (isSuperAdmin(email)) return true;
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return false;
  return Date.now() < parseInt(expiresStr, 10);
}

export function getTimeRemaining(tokenSystemEnabled: boolean): { hours: number; minutes: number; seconds: number } | null {
  if (!tokenSystemEnabled) return null;
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return null;
  const remaining = parseInt(expiresStr, 10) - Date.now();
  if (remaining <= 0) return null;
  return {
    hours: Math.floor(remaining / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

export function AccessBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [tokenEnabled, setTokenEnabled] = useState(true);
  const [time, setTime] = useState<ReturnType<typeof getTimeRemaining>>(null);
  const [dismissed, setDismissed] = useState(false);

  const isPlayerPage = location.pathname.startsWith('/watch/');
  const superAdmin = isSuperAdmin(user?.email);

  useEffect(() => {
    fetchTokenSystemStatus().then(setTokenEnabled);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = getTimeRemaining(tokenEnabled);
      setTime(t);
      if (!t) {
        localStorage.removeItem('unlock_token_expires');
        localStorage.removeItem('unlock_token_id');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenEnabled]);

  if (superAdmin || !time || isPlayerPage || dismissed) return null;

  return (
    <div
      className="sticky top-0 z-[60] text-white px-4 py-2.5 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, hsl(0 72% 30%) 0%, hsl(0 80% 42%) 50%, hsl(0 72% 30%) 100%)',
        boxShadow: '0 4px 20px hsla(0, 80%, 40%, 0.4), 0 0 40px hsla(0, 80%, 40%, 0.15)',
      }}
    >
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-medium tracking-wide">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="opacity-90">Access expires in</span>
          <span
            className="font-mono font-bold text-base px-2.5 py-0.5 rounded-md"
            style={{
              background: 'hsla(0, 0%, 0%, 0.3)',
              textShadow: '0 0 8px hsla(0, 80%, 60%, 0.6)',
              letterSpacing: '0.1em',
            }}
          >
            {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="hover:bg-white/20 rounded-full p-1.5 transition-colors duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
