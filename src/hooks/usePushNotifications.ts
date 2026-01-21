import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_PERMISSION_KEY = 'push_notification_permission';
const LAST_CHECK_KEY = 'last_episode_check';
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

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
  const [isChecking, setIsChecking] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    // Cleanup interval on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
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
        // Immediately check for new episodes
        checkNewEpisodes();
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
      // Check if document is visible - show browser notification only when tab is not focused
      if (document.hidden) {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: true,
          silent: false,
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          if (options?.data?.url) {
            window.location.href = options.data.url;
          }
          notification.close();
        };

        // Auto close after 10 seconds
        setTimeout(() => notification.close(), 10000);
      } else {
        // Show in-app toast when tab is focused
        toast.info(`${title}${options?.body ? `: ${options.body}` : ''}`, {
          action: options?.data?.url ? {
            label: 'Watch Now',
            onClick: () => window.location.href = options.data.url,
          } : undefined,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [permission]);

  const checkNewEpisodes = useCallback(async () => {
    if (!user || permission !== 'granted' || isChecking) return;

    setIsChecking(true);

    try {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const checkTime = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get user's favorite anime IDs
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('anime_id')
        .eq('user_id', user.id);

      if (!favorites || favorites.length === 0) {
        setIsChecking(false);
        return;
      }

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

        // Send notifications with a slight delay between each
        for (let i = 0; i < relevantEpisodes.length; i++) {
          const episode = relevantEpisodes[i] as any;
          
          setTimeout(() => {
            sendNotification(`New Episode: ${episode.season?.anime?.title}`, {
              body: `Episode ${episode.episode_number}: ${episode.title}`,
              tag: `episode-${episode.id}`,
              data: { url: `/watch/${episode.id}` },
            });
          }, i * 1000);
        }
      }

      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error checking new episodes:', error);
    } finally {
      setIsChecking(false);
    }
  }, [user, permission, sendNotification, isChecking]);

  // Set up periodic checking for new episodes
  useEffect(() => {
    if (permission === 'granted' && user) {
      // Initial check
      checkNewEpisodes();
      
      // Set up interval for periodic checks
      checkIntervalRef.current = setInterval(checkNewEpisodes, CHECK_INTERVAL);
      
      // Also check when tab becomes visible
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          checkNewEpisodes();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [permission, user, checkNewEpisodes]);

  // Subscribe to realtime episode inserts for instant notifications
  useEffect(() => {
    if (permission !== 'granted' || !user) return;

    const channel = supabase
      .channel('new-episodes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'episodes',
        },
        async (payload) => {
          // Check if this episode belongs to a favorited anime
          const { data: favorites } = await supabase
            .from('user_favorites')
            .select('anime_id')
            .eq('user_id', user.id);

          if (!favorites) return;

          const episode = payload.new;
          
          // Get season and anime info
          const { data: season } = await supabase
            .from('seasons')
            .select('anime:anime_id(id, title)')
            .eq('id', episode.season_id)
            .single();

          if (season?.anime && favorites.some(f => f.anime_id === (season.anime as any).id)) {
            sendNotification(`New Episode: ${(season.anime as any).title}`, {
              body: `Episode ${episode.episode_number}: ${episode.title}`,
              tag: `episode-${episode.id}`,
              data: { url: `/watch/${episode.id}` },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permission, user, sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    checkNewEpisodes,
    isChecking,
  };
}
