import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_PERMISSION_KEY = 'push_notification_permission';
const LAST_CHECK_KEY = 'last_episode_check';

interface NewEpisode {
  id: string;
  title: string;
  episode_number: number;
  animeTitle: string;
  animeId: string;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, result);
      
      if (result === 'granted') {
        toast.success('Push notifications enabled! You\'ll be notified of new episodes.');
        return true;
      } else if (result === 'denied') {
        toast.error('Push notifications were denied. You can enable them in browser settings.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        if (options?.data?.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [permission]);

  const checkNewEpisodes = useCallback(async () => {
    if (!user || permission !== 'granted') return;

    try {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const checkTime = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get user's favorite anime IDs
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('anime_id')
        .eq('user_id', user.id);

      if (!favorites || favorites.length === 0) return;

      const animeIds = favorites.map(f => f.anime_id);

      // Get new episodes for favorited anime
      const { data: newEpisodes } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          episode_number,
          created_at,
          season:season_id (
            anime:anime_id (
              id,
              title
            )
          )
        `)
        .gt('created_at', checkTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (newEpisodes && newEpisodes.length > 0) {
        const relevantEpisodes = newEpisodes.filter((ep: any) => 
          ep.season?.anime && animeIds.includes(ep.season.anime.id)
        );

        for (const episode of relevantEpisodes as any[]) {
          sendNotification(`New Episode: ${episode.season?.anime?.title}`, {
            body: `Episode ${episode.episode_number}: ${episode.title}`,
            tag: `episode-${episode.id}`,
            data: { url: `/watch/${episode.id}` },
          });
        }
      }

      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error checking new episodes:', error);
    }
  }, [user, permission, sendNotification]);

  // Check for new episodes on mount and every 30 minutes
  useEffect(() => {
    if (permission === 'granted' && user) {
      checkNewEpisodes();
      
      const interval = setInterval(checkNewEpisodes, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [permission, user, checkNewEpisodes]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    checkNewEpisodes,
  };
}
