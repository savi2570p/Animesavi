import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { rememberAccount } from '@/lib/accountUtils';

/**
 * On sign-in, if the user has an active token in localStorage that isn't
 * yet associated with their user_id in the DB, insert a record so
 * fetchTokenAccessFromDB will find it.
 */
async function syncLocalTokenToUser(userId: string) {
  try {
    const expiresStr = localStorage.getItem('unlock_token_expires');
    const tokenId = localStorage.getItem('unlock_token_id');
    if (!expiresStr || !tokenId) return;

    const expiresAt = parseInt(expiresStr, 10);
    if (Date.now() >= expiresAt) return; // already expired

    // Check if this user already has a valid record in DB
    const { data: existing } = await supabase
      .from('token_usage')
      .select('id')
      .eq('user_id', userId)
      .eq('token_id', tokenId)
      .maybeSingle();

    if (existing) return; // already synced

    // Insert a new record linking this token to the user
    await supabase.from('token_usage').insert({
      token_id: tokenId,
      user_id: userId,
      expires_at: expiresAt,
      user_agent: navigator.userAgent,
    });

    localStorage.setItem('token_access_synced', 'true');
  } catch (e) {
    console.error('Failed to sync local token to user:', e);
  }
}

type UserRole = 'viewer' | 'uploader' | 'admin';

/**
 * Refresh throttle.
 *
 * Tab visibility / focus / online events can fire many times a minute (iOS
 * Safari fires them on every app switch). Calling refreshSession on each one
 * hammers the auth endpoint and trips its "Max rate limit reached" guard,
 * which then blocks legitimate sign-ins until the window resets — the exact
 * symptom of "I must restart my device to log in".
 *
 * These helpers make sure at most one refresh is in flight, refreshes are
 * spaced out, and a rate-limit response backs off instead of retrying.
 */
const MIN_REFRESH_GAP_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60_000;

let refreshInFlight: Promise<boolean> | null = null;
let lastRefreshAttempt = 0;
let blockedUntil = 0;

function isRateLimited(message?: string) {
  const m = (message || '').toLowerCase();
  return m.includes('rate limit') || m.includes('too many requests') || m.includes('429');
}

/**
 * Single, throttled session refresh. Resolves true when a session was
 * obtained. Never clears local auth state.
 */
async function throttledRefresh(reason: string): Promise<{ ok: boolean; session: Session | null }> {
  const now = Date.now();
  if (now < blockedUntil) {
    console.warn('[auth] refresh suppressed (rate-limit backoff active), reason:', reason);
    return { ok: false, session: null };
  }
  if (refreshInFlight) {
    await refreshInFlight;
    const { data } = await supabase.auth.getSession();
    return { ok: !!data.session, session: data.session ?? null };
  }
  if (now - lastRefreshAttempt < MIN_REFRESH_GAP_MS) {
    const { data } = await supabase.auth.getSession();
    return { ok: !!data.session, session: data.session ?? null };
  }

  lastRefreshAttempt = now;
  let result: Session | null = null;
  refreshInFlight = supabase.auth
    .refreshSession()
    .then(({ data, error }) => {
      if (data?.session) {
        result = data.session;
        return true;
      }
      if (error) {
        if (isRateLimited(error.message)) {
          blockedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          console.warn('[auth] auth endpoint rate limited — backing off 5 min');
        } else {
          console.warn('[auth] refresh failed, retaining session:', error.message);
        }
      }
      return false;
    })
    .catch((e) => {
      console.warn('[auth] refresh threw, retaining session:', e);
      return false;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  const ok = await refreshInFlight;
  return { ok, session: result };
}

/** True when Supabase storage still holds a refresh token. */
function hasStoredRefreshToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k);
        if (raw && raw.includes('refresh_token')) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isRolesLoaded: boolean;
  roles: UserRole[];
  isUploader: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user roles:', error);
        setRoles([]);
        return;
      }

      setRoles((data ?? []).map((r) => r.role as UserRole));
    } catch (e) {
      console.error('Error fetching user roles:', e);
      setRoles([]);
    } finally {
      setRolesLoaded(true);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // IMPORTANT: keep this callback synchronous to avoid auth deadlocks.
      console.log('[auth] event:', event, 'hasSession:', !!nextSession);

      // Guard against spurious null-session events (SIGNED_OUT / TOKEN_REFRESHED
      // firing with null while Supabase storage still holds a refresh token,
      // e.g. transient network blips, tab-visibility resume, midnight JWT roll).
      // Attempt a silent refresh before clobbering user state. NEVER force logout.
      if (!nextSession && event !== 'INITIAL_SESSION') {
        if (hasStoredRefreshToken()) {
          console.log('[auth] null session with stored refresh token — attempting silent refresh');
          setTimeout(() => {
            void throttledRefresh('auth-event').then(({ session: refreshed }) => {
              if (refreshed) {
                console.log('[auth] token refreshed silently');
                setSession(refreshed);
                setUser(refreshed.user);
                setRolesLoaded(false);
                void fetchUserRoles(refreshed.user.id);
              }
            });
          }, 0);
          return; // don't clobber user state yet
        }

        // No stored refresh token at all — this is a genuine sign-out.
        console.log('[auth] genuine sign-out (no stored refresh token). Reason:', event);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        if (event === 'INITIAL_SESSION') console.log('[auth] session restored for', nextSession.user.email);
        if (event === 'TOKEN_REFRESHED') console.log('[auth] token refreshed for', nextSession.user.email);
        setRolesLoaded(false);
        if (event === 'SIGNED_IN') {
          const email = nextSession.user.email || '';
          const username = nextSession.user.user_metadata?.username || email.split('@')[0];
          rememberAccount(email, username, 5);
          setTimeout(() => void syncLocalTokenToUser(nextSession.user.id), 0);
        }
        setTimeout(() => {
          void fetchUserRoles(nextSession.user.id);
        }, 0);
      } else {
        setRoles([]);
        setRolesLoaded(true);
      }

      setIsLoading(false);
    });

    // Initial session fetch
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          console.log('[auth] initial session found for', initialSession.user.email);
          setRolesLoaded(false);
          void fetchUserRoles(initialSession.user.id);
        } else {
          console.log('[auth] no initial session');
          setRoles([]);
          setRolesLoaded(true);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Recover session when tab becomes visible or network reconnects.
    // Handles iOS Safari / PWA suspending the tab and Android Chrome backgrounding.
    const tryRecover = (reason: string) => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) return; // still good — no network call needed
        if (!hasStoredRefreshToken()) return;
        console.log('[auth] recovery attempt (', reason, ')');
        void throttledRefresh(reason).then(({ session: recovered }) => {
          if (recovered) {
            console.log('[auth] session recovered after', reason);
            setSession(recovered);
            setUser(recovered.user);
            setRolesLoaded(false);
            void fetchUserRoles(recovered.user.id);
          }
        });
      }).catch(() => {});
    };
    const onVisible = () => { if (document.visibilityState === 'visible') tryRecover('visibility'); };
    const onOnline = () => tryRecover('online');
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const signUp = async (email: string, password: string, username?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username || normalizedEmail.split('@')[0],
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    // A sign-in attempt must never race a background refresh — that pairing is
    // what pushed the auth endpoint into its rate limit.
    blockedUntil = Math.max(blockedUntil, Date.now() + 30_000);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error && isRateLimited(error.message)) {
      blockedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      return {
        error: new Error(
          'Too many sign-in attempts were made. Please wait about a minute and try again — no need to restart your device.'
        ),
      };
    }

    if (!error) blockedUntil = 0;

    return { error: error as Error | null };
  };

  const signOut = async () => {
    console.log('[auth] user-initiated signOut');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Error signing out:', error);
      }
    } finally {
      // Clear any stale unlock-token cache so the "PRO active" banner
      // disappears immediately on logout instead of showing leftover time.
      try {
        localStorage.removeItem('unlock_token_expires');
        localStorage.removeItem('unlock_token_id');
        localStorage.removeItem('token_access_synced');
      } catch { /* ignore */ }
      setSession(null);
      setUser(null);
      setRoles([]);
      setRolesLoaded(true);
    }
  };

  const isUploader = rolesLoaded && (roles.includes('uploader') || roles.includes('admin'));
  const isAdmin = rolesLoaded && roles.includes('admin');
  const isRolesLoaded = rolesLoaded;

  // Memoized so consumers (header, home rows, player) don't re-render on every
  // provider render — only when auth state actually changes.
  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isRolesLoaded,
      roles,
      isUploader,
      isAdmin,
      signUp,
      signIn,
      signOut,
    }),
    [user, session, isLoading, isRolesLoaded, roles, isUploader, isAdmin]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
