import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/** Client navigation guard. Database policies and edge functions remain the
 * authoritative permission checks; this prevents admin screens rendering early. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading, isRolesLoaded } = useAuth();
  const location = useLocation();

  if (isLoading || (user && !isRolesLoaded)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background" aria-label="Checking admin access">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
