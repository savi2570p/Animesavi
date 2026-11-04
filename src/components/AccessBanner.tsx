import { useState, useEffect, useCallback } from 'react';
import { Clock, Crown, Cloud, AlertTriangle } from 'lucide-react';
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
      // Not logged in — never trust localStorage alone. Clear stale cache so
      // the PRO/Premium banner doesn't show "3 months active" after sign-out.
      try {
        localStorage.removeItem('unlock_token_expires');
        localStorage.removeItem('unlock_token_id');
        localStorage.removeItem('token_access_synced');
      } catch { /* ignore */ }
      return { hasAccess: false, expiresAt: null };
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
    return { hasAccess: false, expiresAt: null };
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
  // Resolve the cached expiry SYNCHRONOUSLY on first render so the banner slot
  // has its final geometry from the very first paint (no post-hydration jump).
  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('unlock_token_expires');
      const exp = raw ? parseInt(raw, 10) : 0;
      return exp && Date.now() < exp ? exp : null;
    } catch {
      return null;
    }
  });
  const [time, setTime] = useState<ReturnType<typeof getTimeRemaining>>(() =>
    getTimeRemaining(true, null)
  );
  const [dbChecked, setDbChecked] = useState(false);
  const isSynced = wasAccessSyncedFromCloud();

  // Skip entirely on embed routes
  const isEmbedRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    window.location.pathname.startsWith('/s2') ||
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

  const visible = !(isEmbedRoute || superAdmin || !time || isCasting);

  if (!visible) return null;

  // Compute friendly date/time of expiry + urgency tier
  const expDate = expiresAt ? new Date(expiresAt) : null;
  const totalMinutes = time.hours * 60 + time.minutes;
  const isCritical = totalMinutes < 30;
  const isLow = totalMinutes < 120 && !isCritical;
  const tone = isCritical ? 'critical' : isLow ? 'low' : 'active';
  const label = isCritical ? 'Expiring soon' : isLow ? 'Running low' : 'Premium active';
  const days = Math.floor(time.hours / 24);
  const countdown = days >= 1
    ? `${days}d ${String(time.hours % 24).padStart(2, '0')}h`
    : `${String(time.hours).padStart(2, '0')}h ${String(time.minutes).padStart(2, '0')}m`;

  const dateLabel = expDate
    ? expDate.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="access-banner access-v7 sticky top-0 z-[60] relative overflow-hidden animate-fade-in" data-tone={tone} role="status" aria-label={`${label}, ${countdown} left`}>
      <span className="access-v7-sheen" aria-hidden="true" />
      <div className="container relative flex h-full items-center justify-between gap-2 px-3">
        <div className="access-v7-status">
          <span className="access-v7-dot" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {isCritical && <AlertTriangle className="access-v7-alert" aria-hidden="true" />}
        </div>

        <div className="access-v7-timer">
          <Clock aria-hidden="true" />
          <span className="tabular-nums">{countdown}</span>
          <span className="access-v7-left">left</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {dateLabel && <span className="access-v7-date">Ends {dateLabel}</span>}
          <span className="access-v7-pro"><Crown aria-hidden="true" /><span className="hidden xs:inline">PRO</span></span>
          {isSynced && <Cloud className="access-v7-cloud" aria-label="Synced from cloud" />}
        </div>
      </div>
    </div>
  );
}
