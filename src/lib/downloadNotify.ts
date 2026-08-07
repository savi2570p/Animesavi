// Background notifications for batch downloads.
// Uses the Web Notification API (via the active service worker when available)
// so users get told when a batch finishes or an episode fails even if the tab
// is in the background. Silently no-ops when permission is denied.

const DND_KEY = 'notifications_dnd';

export const isDnd = () => {
  try { return localStorage.getItem(DND_KEY) === 'true'; } catch { return false; }
};

export async function ensureDownloadNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

export async function notifyDownload(title: string, body: string, tag = 'animesavi-download') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (isDnd()) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    tag,
    icon: '/Animesavi+.png?v=3',
    badge: '/Animesavi+.png?v=3',
  };

  try {
    // Prefer the service worker so the notification survives a backgrounded tab.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch { /* fall through */ }

  try { new Notification(title, options); } catch { /* ignore */ }
}
