import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCastDetection } from '@/hooks/useCastDetection';

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

/**
 * DB-authoritative token access check.
 * Fetches the latest expiration from the database for the current user.
 * Falls back to localStorage only for non-logged-in users.
 */
export async function fetchTokenAccessFromDB(): Promise<{ hasAccess: boolean; expiresAt: number | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      // Not logged in — fall back to localStorage
      const expiresStr = localStorage.getItem('unlock_token_expires');
      if (!expiresStr) return { hasAccess: false, expiresAt: null };
      const exp = parseInt(expiresStr, 10);
      return { hasAccess: Date.now() < exp, expiresAt: exp };
    }

    // Fetch from DB — single source of truth
    const { data } = await supabase
      .from('token_usage')
      .select('expires_at, token_id')
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.expires_at && Date.now() < Number(data.expires_at)) {
      // Sync to localStorage as cache (for offline / quick reads)
      localStorage.setItem('unlock_token_expires', data.expires_at.toString());
      localStorage.setItem('unlock_token_id', data.token_id);
      return { hasAccess: true, expiresAt: Number(data.expires_at) };
    }

    // Expired or no grant — clear localStorage
    localStorage.removeItem('unlock_token_expires');
    localStorage.removeItem('unlock_token_id');
    localStorage.removeItem('token_access_synced');
    return { hasAccess: false, expiresAt: null };
  } catch {
    // On error, fall back to localStorage
    const expiresStr = localStorage.getItem('unlock_token_expires');
    if (!expiresStr) return { hasAccess: false, expiresAt: null };
    const exp = parseInt(expiresStr, 10);
    return { hasAccess: Date.now() < exp, expiresAt: exp };
  }
}

/** Quick client-side check using localStorage cache — use for non-critical UI hints */
export function hasValidTokenAccess(email?: string | null): boolean {
  if (isSuperAdmin(email)) return true;
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return false;
  return Date.now() < parseInt(expiresStr, 10);
}

/**
 * Sync token access from DB → localStorage for logged-in users.
 * This ensures access persists when the PWA is added to the home screen.
 */
export async function syncTokenAccessFromDB(): Promise<boolean> {
  try {
    const result = await fetchTokenAccessFromDB();
    if (result.hasAccess && result.expiresAt) {
      localStorage.setItem('token_access_synced', 'true');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** @deprecated Use fetchTokenSystemStatus + hasValidTokenAccess instead */
export function hasValidAccess(email?: string | null): boolean {
  if (isSuperAdmin(email)) return true;
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return false;
  return Date.now() < parseInt(expiresStr, 10);
}

export function getTimeRemaining(tokenSystemEnabled: boolean, expiresAt?: number | null): { hours: number; minutes: number; seconds: number } | null {
  if (!tokenSystemEnabled) return null;
  // Use provided expiresAt (from DB) or fall back to localStorage
  const exp = expiresAt ?? parseInt(localStorage.getItem('unlock_token_expires') || '0', 10);
  if (!exp) return null;
  const remaining = exp - Date.now();
  if (remaining <= 0) return null;
  return {
    hours: Math.floor(remaining / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

/** Check if current token access was synced from cloud (DB) */
export function wasAccessSyncedFromCloud(): boolean {
  return localStorage.getItem('token_access_synced') === 'true';
}

export function AccessBanner() {
  const { user } = useAuth();
  const isCasting = useCastDetection();
  const [tokenEnabled, setTokenEnabled] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [time, setTime] = useState<ReturnType<typeof getTimeRemaining>>(null);
  const [dbChecked, setDbChecked] = useState(false);
  const isSynced = wasAccessSyncedFromCloud();

  // Skip entirely on embed routes
  const isEmbedRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  const superAdmin = isSuperAdmin(user?.email);

  // Fetch token system status once
  useEffect(() => {
    fetchTokenSystemStatus().then(setTokenEnabled);
  }, []);

  // DB-authoritative fetch on every mount (page load) and when user changes
  const checkAccessFromDB = useCallback(async () => {
    const result = await fetchTokenAccessFromDB();
    setExpiresAt(result.hasAccess ? result.expiresAt : null);
    setDbChecked(true);
  }, []);

  useEffect(() => {
    checkAccessFromDB();
  }, [checkAccessFromDB, user?.id]);

  // Countdown timer — uses DB-sourced expiresAt. Pause while casting/mirroring.
  useEffect(() => {
    if (!dbChecked) return;
    if (isCasting) return; // freeze countdown UI while casting
    const interval = setInterval(() => {
      const t = getTimeRemaining(tokenEnabled, expiresAt);
      setTime(t);
      if (!t && expiresAt) {
        // Expired — clean up
        setExpiresAt(null);
        localStorage.removeItem('unlock_token_expires');
        localStorage.removeItem('unlock_token_id');
        localStorage.removeItem('token_access_synced');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenEnabled, expiresAt, dbChecked, isCasting]);

  if (isEmbedRoute || superAdmin || !time || isCasting) return null;

  return (
    <div
      className="sticky top-0 z-[60] text-white px-3 py-1 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, hsl(0 72% 30%) 0%, hsl(0 80% 42%) 50%, hsl(0 72% 30%) 100%)',
        boxShadow: '0 2px 10px hsla(0, 80%, 40%, 0.3)',
      }}
    >
      <div className="container flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide">
          <Clock className="h-3 w-3 animate-pulse" />
          <span className="opacity-90">Expires</span>
          <span
            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'hsla(0, 0%, 0%, 0.3)',
              textShadow: '0 0 8px hsla(0, 80%, 60%, 0.6)',
              letterSpacing: '0.08em',
            }}
          >
            {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}
          </span>
          {isSynced && (
            <span
              className="text-[10px] px-1 py-px rounded-full opacity-70"
              style={{ background: 'hsla(210, 80%, 50%, 0.25)' }}
              title="Synced from account"
            >
              ☁️
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
