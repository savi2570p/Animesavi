import { Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasValidTokenAccess } from '@/components/AccessBanner';

/**
 * Shows a premium crown badge on anime thumbnails when the user
 * does NOT have active token access. Hidden for premium users.
 * Place inside a `position: relative` thumbnail container.
 */
export function PremiumBadge({ variant = 'card' }: { variant?: 'card' | 'avatar' | 'label' }) {
  return (
    <span className={`premium-emblem premium-emblem--${variant}`} role="img" aria-label="Premium" title="Premium">
      <Crown aria-hidden="true" strokeWidth={1.8} />
      {variant === 'label' && <span>Premium</span>}
    </span>
  );
}

export function TokenCrownBadge() {
  const { user } = useAuth();
  const hasAccess = hasValidTokenAccess(user?.email);

  if (hasAccess) return null;

  return (
    <div className="absolute bottom-2 right-2 z-30 pointer-events-none">
      <PremiumBadge />
    </div>
  );
}
