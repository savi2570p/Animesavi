import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTokenAccessFromDB, fetchTokenSystemStatus, isSuperAdmin } from '@/components/AccessBanner';

type PopupType = 'expired' | 'whatsNew' | 'welcome';

const NOTICE_VERSION = 'v11';

interface PopupQueueContextType {
  activePopup: PopupType | null;
  dismissPopup: () => void;
  showWhatsNewManually: () => void;
}

const PopupQueueContext = createContext<PopupQueueContextType>({
  activePopup: null,
  dismissPopup: () => {},
  showWhatsNewManually: () => {},
});

export const usePopupQueue = () => useContext(PopupQueueContext);

export function PopupQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [queue, setQueue] = useState<PopupType[]>([]);
  const [ready, setReady] = useState(false);
  const [manualWhatsNew, setManualWhatsNew] = useState(false);

  const isEmbedRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  // Only show auto popups on "/" route
  const isHomeRoute = location.pathname === '/';

  useEffect(() => {
    if (isEmbedRoute || !isHomeRoute) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function buildQueue() {
      const popups: PopupType[] = [];

      // 1. Expired access (highest priority)
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

      // 2. What's New
      const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
      const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');

      if (hasSeenWelcome && seenNoticeVersion !== NOTICE_VERSION) {
        popups.push('whatsNew');
      }

      // 3. Welcome (first visit)
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
  }, [user?.email, user?.id, isEmbedRoute, isHomeRoute]);

  const dismissPopup = useCallback(() => {
    if (manualWhatsNew) {
      setManualWhatsNew(false);
      return;
    }

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
      // After welcome dismiss, check if whatsNew should follow
      if (current === 'welcome' && !next.includes('whatsNew')) {
        const seenNoticeVersion = localStorage.getItem('notice_popup_seen_version');
        if (seenNoticeVersion !== NOTICE_VERSION) {
          return ['whatsNew', ...next];
        }
      }
      return next;
    });
  }, [manualWhatsNew]);

  const showWhatsNewManually = useCallback(() => {
    setManualWhatsNew(true);
  }, []);

  // Determine active popup: manual whatsNew takes precedence if no queue popup
  let activePopup: PopupType | null = null;
  if (ready && queue.length > 0) {
    activePopup = queue[0];
  } else if (manualWhatsNew) {
    activePopup = 'whatsNew';
  }

  // Lock scroll only when popup is active
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (activePopup) {
      html.classList.add('scroll-locked');
      body.classList.add('scroll-locked');
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    } else {
      html.classList.remove('scroll-locked');
      body.classList.remove('scroll-locked');
      body.style.overflow = 'auto';
      html.style.overflow = 'auto';
      body.style.position = 'static';
    }
    return () => {
      html.classList.remove('scroll-locked');
      body.classList.remove('scroll-locked');
      body.style.overflow = 'auto';
      html.style.overflow = 'auto';
      body.style.position = 'static';
    };
  }, [activePopup]);

  return (
    <PopupQueueContext.Provider value={{ activePopup, dismissPopup, showWhatsNewManually }}>
      {children}
    </PopupQueueContext.Provider>
  );
}
