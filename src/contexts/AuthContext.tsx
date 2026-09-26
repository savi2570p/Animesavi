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

    // Only link tokens that are still active; stale/revoked ids would be
    // rejected by row security and just spam errors.
    const { data: valid } = await supabase.rpc('get_token_duration', { _token_id: tokenId });
    if (valid == null) return;
    const { data: status } = await supabase.rpc('verify_unlock_token' as any, { _token: '' }).then(() => ({ data: null }), () => ({ data: null }));
    void status;
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

const MIN_REFRESH_GAP_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60_000;
let lastRefreshAt = 0;
let backoffUntil = 0;
let refreshInFlight: ReturnType<typeof supabase.auth.refreshSession> | null = null;
const isRateLimited = (e: any) =>
  !!e && (e.status === 429 || /rate limit|too many/i.test(String(e.message || '')));

/** De-duplicated, gap-limited refresh with backoff after rate limiting. */
function throttledRefresh(): ReturnType<typeof supabase.auth.refreshSession> {
  const now = Date.now();
  if (refreshInFlight) return refreshInFlight;
  if (now < backoffUntil || now - lastRefreshAt < MIN_REFRESH_GAP_MS) {
    return Promise.resolve({ data: { session: null, user: null }, error: null }) as any;
  }
  lastRefreshAt = now;
  refreshInFlight = throttledRefresh().then((r) => {
    if (isRateLimited(r.error)) backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    return r;
  }).finally(() => { refreshInFlight = null; }) as any;
  return refreshInFlight!;
}

type UserRole = 'viewer' | 'uploader' | 'admin';

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
        const hasStoredSession = (() => {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                const raw = localStorage.getItem(k);
                if (raw && raw.includes('refresh_token')) return true;
              }
            }
          } catch {}
          return false;
        })();

        if (hasStoredSession) {
          console.log('[auth] null session with stored refresh token — attempting silent refresh');
          setTimeout(() => {
            throttledRefresh().then(({ data, error }) => {
              if (data?.session) {
                console.log('[auth] token refreshed silently');
                setSession(data.session);
                setUser(data.session.user);
                setRolesLoaded(false);
                void fetchUserRoles(data.session.user.id);
              } else if (error) {
                console.warn('[auth] silent refresh failed, retaining session:', error.message);
              }
            }).catch((e) => console.warn('[auth] refresh threw, retaining session:', e));
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
        if (data.session) return; // still good
        // Try refresh only if a stored refresh token exists.
        let hasStored = false;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              const raw = localStorage.getItem(k);
              if (raw && raw.includes('refresh_token')) { hasStored = true; break; }
            }
          }
        } catch {}
        if (!hasStored) return;
        console.log('[auth] recovery attempt (', reason, ')');
        throttledRefresh().then(({ data: d, error }) => {
          if (d?.session) {
            console.log('[auth] session recovered after', reason);
            setSession(d.session);
            setUser(d.session.user);
            setRolesLoaded(false);
            void fetchUserRoles(d.session.user.id);
          } else if (error) {
            console.warn('[auth] recovery failed (', reason, '):', error.message);
          }
        }).catch(() => {});
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

    if (Date.now() < backoffUntil) {
      const mins = Math.ceil((backoffUntil - Date.now()) / 60000);
      return { error: new Error(`Too many sign-in attempts. Please wait about ${mins} minute${mins > 1 ? 's' : ''} and try again.`) };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (isRateLimited(error)) {
      backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      return { error: new Error('Too many sign-in attempts. Please wait a few minutes and try again.') };
    }

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
