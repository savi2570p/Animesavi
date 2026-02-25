import { Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasValidTokenAccess } from '@/components/AccessBanner';

/**
 * Shows a golden crown badge on anime thumbnails when the user
 * does NOT have active token access. Hidden for premium users.
 * Place inside a `position: relative` thumbnail container.
 */
export function TokenCrownBadge() {
  const { user } = useAuth();
  const hasAccess = hasValidTokenAccess(user?.email);

  if (hasAccess) return null;

  return (
    <div className="absolute bottom-2 right-2 z-30 p-1.5 rounded-full bg-yellow-500/90 shadow-lg shadow-yellow-500/30 animate-pulse">
      <Crown className="h-3.5 w-3.5 text-black" />
    </div>
  );
}
