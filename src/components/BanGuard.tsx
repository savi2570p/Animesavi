import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkBanStatus, clearExpiredBan } from '@/lib/banUtils';
import { BanScreen } from '@/components/BanScreen';

export function BanGuard() {
  const { user } = useAuth();
  const [banned, setBanned] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    clearExpiredBan();
    checkBanStatus(user?.id).then((info) => {
      if (info.isBanned && info.expiresAt) {
        setBanned(true);
        setExpiresAt(info.expiresAt);
      }
    });
  }, [user?.id]);

  const handleExpired = useCallback(() => {
    setBanned(false);
    setExpiresAt(null);
    clearExpiredBan();
  }, []);

  if (!banned || !expiresAt) return null;

  return <BanScreen expiresAt={expiresAt} onExpired={handleExpired} />;
}
