import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setRolesLoaded(false);
        if (event === 'SIGNED_IN') {
          const email = nextSession.user.email || '';
          const username = nextSession.user.user_metadata?.username || email.split('@')[0];
          rememberAccount(email, username, 5);
          // Sync any localStorage token to DB for this user
          setTimeout(() => void syncLocalTokenToUser(nextSession.user.id), 0);
        }
        // Defer any extra backend calls.
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
          setRolesLoaded(false);
          void fetchUserRoles(initialSession.user.id);
        } else {
          setRoles([]);
          setRolesLoaded(true);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username || email.split('@')[0],
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setRolesLoaded(true);
  };

  const isUploader = rolesLoaded && (roles.includes('uploader') || roles.includes('admin'));
  const isAdmin = rolesLoaded && roles.includes('admin');
  const isRolesLoaded = rolesLoaded;

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
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
