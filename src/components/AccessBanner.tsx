import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const SUPER_ADMIN_EMAILS = [
  'savi2570p@gmail.com',
  'savipanjeta2@gmail.com',
];

const TOKEN_SYSTEM_KEY = 'token_system_enabled';

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isTokenSystemEnabled(): boolean {
  const val = localStorage.getItem(TOKEN_SYSTEM_KEY);
  // Default to enabled if not set
  return val !== 'false';
}

export function setTokenSystemEnabled(enabled: boolean) {
  localStorage.setItem(TOKEN_SYSTEM_KEY, String(enabled));
}

/** Sync the token system flag from DB (app_settings or unlock_tokens metadata). 
 *  We use a simple approach: check a special token with token='__system_disabled__' */
export async function syncTokenSystemFlag() {
  const { data } = await supabase
    .from('unlock_tokens')
    .select('is_active')
    .eq('token', '__system_toggle__')
    .maybeSingle();
  
  if (data) {
    // is_active=true means system is enabled, false means disabled
    localStorage.setItem(TOKEN_SYSTEM_KEY, String(data.is_active));
  }
}

export function hasValidAccess(email?: string | null): boolean {
  if (isSuperAdmin(email)) return true;
  if (!isTokenSystemEnabled()) return true; // System disabled = everyone has access
  const expiresStr = localStorage.getItem('unlock_token_expires');
  if (!expiresStr) return false;
  return Date.now() < parseInt(expiresStr, 10);
}

export function getTimeRemaining(): { hours: number; minutes: number; seconds: number } | null {
  if (!isTokenSystemEnabled()) return null;
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
  const [time, setTime] = useState(getTimeRemaining());
  const [dismissed, setDismissed] = useState(false);

  const isPlayerPage = location.pathname.startsWith('/watch/');
  const superAdmin = isSuperAdmin(user?.email);

  useEffect(() => {
    syncTokenSystemFlag();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = getTimeRemaining();
      setTime(t);
      if (!t) {
        localStorage.removeItem('unlock_token_expires');
        localStorage.removeItem('unlock_token_id');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (superAdmin || !time || isPlayerPage || dismissed) return null;

  return (
    <div className="sticky top-0 z-[60] bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 py-2">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          <span>Access expires in: </span>
          <span className="font-mono font-bold">
            {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="hover:bg-white/20 rounded p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
