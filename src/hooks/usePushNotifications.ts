import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const SW_PATH = '/push-sw.js';

interface NotificationSettings {
  newEpisodes: boolean;
  favorites: boolean;
  sound: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  newEpisodes: true,
  favorites: true,
  sound: true,
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const vapidKeyRef = useRef<string | null>(null);

  // Load saved settings
  useEffect(() => {
    try {
      const s = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (s) setSettings(JSON.parse(s));
    } catch {}
  }, []);

  // Detect support — push + SW + permissions
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  // Check existing subscription
  useEffect(() => {
    if (!isSupported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {}
    })();
  }, [isSupported, user?.id]);

  const updateSettings = useCallback((next: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const fetchVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;
    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
      if (error || !data?.publicKey) {
        console.log('[push] failed to fetch VAPID key', error);
        return null;
      }
      vapidKeyRef.current = data.publicKey as string;
      return vapidKeyRef.current;
    } catch (e) {
      console.log('[push] VAPID fetch error', e);
      return null;
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }
    if (!user) {
      toast.error('Please sign in to enable notifications');
      return false;
    }

    try {
      // Register the dedicated push service worker
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapid = await fetchVapidKey();
      if (!vapid) {
        toast.error('Notification service is not configured yet.');
        return false;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }

      const json: any = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = json?.keys?.p256dh || arrayBufferToBase64(sub.getKey('p256dh'));
      const auth = json?.keys?.auth || arrayBufferToBase64(sub.getKey('auth'));

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        console.log('[push] save failed', error);
        toast.error('Could not save your device. Please try again.');
        return false;
      }

      console.log('[push] subscribed & saved', endpoint.slice(-24));
      setIsSubscribed(true);
      return true;
    } catch (e: any) {
      console.log('[push] subscribe error', e);
      toast.error(e?.message || 'Failed to subscribe to push notifications');
      return false;
    }
  }, [isSupported, user, fetchVapidKey]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }
    try {
      // iOS Safari: only works as installed PWA
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
      if (isIOS && !isStandalone) {
        toast.error('On iPhone, add AnimeSavi to your Home Screen first to enable push notifications.');
        return false;
      }

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        console.log('[push] permission granted');
        const ok = await subscribe();
        if (ok) toast.success("Notifications enabled — you'll be alerted on new episodes.");
        return ok;
      }
      if (result === 'denied') {
        console.log('[push] permission denied');
        toast.error('Notifications were blocked. You can re-enable them from your browser site settings.');
      }
      return false;
    } catch (e) {
      console.log('[push] permission error', e);
      return false;
    }
  }, [isSupported, subscribe]);

  const sendTestNotification = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-test-push');
      if (error || data?.error) {
        toast.error(data?.error || 'Failed to send test');
        return;
      }
      toast.success(`Test sent to ${data.sent} device(s).`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send test');
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    settings,
    updateSettings,
    requestPermission,
    sendTestNotification,
    // Legacy compatibility (no-op): in-app polling replaced by DB push
    sendNotification: () => {},
    checkNewEpisodes: () => {},
    isChecking: false,
  };
}
