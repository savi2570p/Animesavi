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

  const visible = !(isEmbedRoute || superAdmin || !time || isCasting);

  // Toggle a body class so the Header can drop its own safe-area-top padding
  // when the banner is already sitting in the safe area above it (prevents a
  // visible gap between banner and nav on iOS/Android).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (visible) document.body.classList.add('has-access-banner');
    else document.body.classList.remove('has-access-banner');
    return () => document.body.classList.remove('has-access-banner');
  }, [visible]);

  if (!visible) return null;

  // Compute friendly date/time of expiry + urgency tier
  const expDate = expiresAt ? new Date(expiresAt) : null;
  const totalMinutes = time.hours * 60 + time.minutes;
  const isCritical = totalMinutes < 30;
  const isLow = totalMinutes < 120 && !isCritical;

  const tone = isCritical
    ? { ring: 'hsl(270 80% 60%)', glow: 'hsla(270,80%,60%,0.55)', dot: 'bg-rose-300', label: 'Expiring soon' }
    : isLow
    ? { ring: 'hsl(35 95% 55%)', glow: 'hsla(35,95%,55%,0.45)', dot: 'bg-amber-200', label: 'Heads up' }
    : { ring: 'hsl(150 70% 45%)', glow: 'hsla(150,70%,45%,0.4)', dot: 'bg-emerald-200', label: 'Premium active' };

  const dateLabel = expDate
    ? expDate.toLocaleString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className="access-banner sticky top-0 z-[60] text-white animate-fade-in relative overflow-hidden"
      style={{
        height: 25,
        minHeight: 25,
        maxHeight: 25,
        paddingTop: 0,
        paddingBottom: 0,
        // Liquid-glass tinted surface — tone-adaptive
        background: `linear-gradient(90deg, hsla(0,0%,8%,0.55) 0%, hsla(0,0%,10%,0.35) 50%, hsla(0,0%,8%,0.55) 100%)`,
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        backdropFilter: 'blur(22px) saturate(180%)',
        boxShadow: `0 6px 24px -14px ${tone.glow}, inset 0 -1px 0 hsla(0,0%,100%,0.08), inset 0 1px 0 hsla(0,0%,100%,0.10)`,
      }}
    >
      {/* Frosted glass tint layer that adapts to urgency */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(120% 200% at 50% 0%, ${tone.glow} 0%, transparent 55%)`,
        }}
      />
      {/* Refraction highlight along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsla(0,0%,100%,0.55), transparent)',
        }}
      />
      {/* Slow travelling specular sheen */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
        <div
          className="absolute inset-y-0 -inset-x-1/3"
          style={{
            background:
              'linear-gradient(110deg, transparent 30%, hsla(0,0%,100%,0.14) 50%, transparent 70%)',
            animation: 'shimmer 6s linear infinite',
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      <div className="container relative flex items-center justify-between gap-2 px-3 h-full">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: tone.ring }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: tone.ring, boxShadow: `0 0 6px ${tone.glow}` }}
            />
          </span>
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] opacity-95 truncate leading-none">
            {tone.label}
          </span>
          {isCritical && <AlertTriangle className="h-2.5 w-2.5 text-amber-200 shrink-0 animate-pulse" />}
        </div>

        <div
          className="flex items-center gap-1 px-2 py-[3px] rounded-full shrink-0"
          style={{
            background: 'hsla(0, 0%, 100%, 0.06)',
            border: `1px solid hsla(0,0%,100%,0.18)`,
            boxShadow: `0 0 10px -3px ${tone.glow}, inset 0 1px 0 hsla(0,0%,100%,0.18)`,
            WebkitBackdropFilter: 'blur(12px) saturate(160%)',
            backdropFilter: 'blur(12px) saturate(160%)',
          }}
        >
          <Clock className="h-2.5 w-2.5" style={{ color: tone.ring }} />
          <span
            className="font-mono font-bold text-[9px] sm:text-[10px] tabular-nums tracking-wider leading-none"
            style={{ textShadow: `0 0 8px ${tone.glow}` }}
          >
            {String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m
          </span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          {dateLabel && (
            <span className="hidden md:inline-flex text-[9px] font-medium opacity-80 truncate leading-none">
              ends · {dateLabel}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[8px] font-black uppercase tracking-wider leading-none"
            style={{
              background: 'linear-gradient(135deg, hsla(45,95%,60%,0.28), hsla(30,90%,55%,0.20))',
              color: 'hsl(45, 95%, 78%)',
              border: '1px solid hsla(45,95%,60%,0.35)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.2)',
            }}
          >
            <Crown className="h-2 w-2" />
            <span className="hidden xs:inline">PRO</span>
          </span>
          {isSynced && <Cloud className="h-2.5 w-2.5 opacity-70" aria-label="Synced from cloud" />}
        </div>
      </div>
    </div>
  );
}

