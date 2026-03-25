import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTokenAccessFromDB, fetchTokenSystemStatus, isSuperAdmin } from '@/components/AccessBanner';

type PopupType = 'expired' | 'whatsNew' | 'welcome';

const NOTICE_VERSION = 'v9';

interface PopupQueueContextType {
  activePopup: PopupType | null;
  dismissPopup: () => void;
}

const PopupQueueContext = createContext<PopupQueueContextType>({
  activePopup: null,
  dismissPopup: () => {},
});

export const usePopupQueue = () => useContext(PopupQueueContext);

export function PopupQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<PopupType[]>([]);
  const [ready, setReady] = useState(false);

  // Skip on embed routes
  const isEmbedRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  useEffect(() => {
    if (isEmbedRoute) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function buildQueue() {
      const popups: PopupType[] = [];

      // 1. Check expired access (highest priority)
      const alreadyShownExpired = sessionStorage.getItem('token_expired_popup_shown');
      if (!alreadyShownExpired && !isSuperAdmin(user?.email)) {
        try {
          const enabled = await fetchTokenSystemStatus();
          if (enabled && !cancelled) {
            const result = await fetchTokenAccessFromDB();
            if (!result.hasAccess) {
              popups.push('expired');
            }
          }
        } catch {
          // ignore
        }
      }

      if (cancelled) return;

      // 2. Check What's New
      const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
      const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');

      if (hasSeenWelcome && seenNoticeVersion !== NOTICE_VERSION) {
        popups.push('whatsNew');
      }

      // 3. Check first visit (Welcome)
      if (!hasSeenWelcome) {
        popups.push('welcome');
      }

      if (!cancelled) {
        setQueue(popups);
        setReady(true);
      }
    }

    buildQueue();
    return () => { cancelled = true; };
  }, [user?.email, user?.id, isEmbedRoute]);

  const dismissPopup = useCallback(() => {
    setQueue((prev) => {
      const current = prev[0];
      if (current === 'expired') {
        sessionStorage.setItem('token_expired_popup_shown', 'true');
      } else if (current === 'whatsNew') {
        localStorage.setItem('notice_popup_seen_version', NOTICE_VERSION);
      } else if (current === 'welcome') {
        localStorage.setItem('has_seen_welcome', 'true');
      }
      const next = prev.slice(1);
      // If welcome was dismissed and whatsNew is next, that's fine
      // But if welcome was dismissed and whatsNew wasn't in queue, check if we need it
      if (current === 'welcome' && !next.includes('whatsNew')) {
        const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
        if (seenNoticeVersion !== NOTICE_VERSION) {
          return ['whatsNew', ...next];
        }
      }
      return next;
    });
  }, []);

  const activePopup = ready && queue.length > 0 ? queue[0] : null;

  // Lock scroll when popup is active
  useEffect(() => {
    if (activePopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePopup]);

  return (
    <PopupQueueContext.Provider value={{ activePopup, dismissPopup }}>
      {children}
    </PopupQueueContext.Provider>
  );
}
