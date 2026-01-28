import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_PERMISSION_KEY = 'push_notification_permission';
const LAST_CHECK_KEY = 'last_episode_check';
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

interface NotificationSettings {
  newEpisodes: boolean;
  favorites: boolean;
  sound: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  newEpisodes: true,
  favorites: true,
  sound: true
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }, []);

  // Check if notifications are supported
  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Save settings to localStorage
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
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
      if (document.hidden) {
        const notification = new Notification(title, {
          icon: 'https://storage.googleapis.com/gpt-engineer-file-uploads/9zI1yCNlGfZymWSADZuYy9FGrtQ2/uploads/1768537236542-logo.png',
          badge: 'https://storage.googleapis.com/gpt-engineer-file-uploads/9zI1yCNlGfZymWSADZuYy9FGrtQ2/uploads/1768537236542-logo.png',
          requireInteraction: true,
          silent: !settings.sound,
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          if (options?.data?.url) {
            window.location.href = options.data.url;
          }
          notification.close();
        };

        setTimeout(() => notification.close(), 10000);
      } else {
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
  }, [permission, settings.sound]);

  const checkNewEpisodes = useCallback(async () => {
    if (!user || permission !== 'granted' || isChecking || !settings.newEpisodes) return;

    setIsChecking(true);

    try {
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const checkTime = lastCheck ? new Date(lastCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (!settings.favorites) {
        // Check all new episodes if favorites notifications are disabled
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
          .limit(5);

        if (newEpisodes && newEpisodes.length > 0) {
          newEpisodes.slice(0, 3).forEach((episode: any, i: number) => {
            setTimeout(() => {
              sendNotification(`New Episode: ${episode.season?.anime?.title}`, {
                body: `Episode ${episode.episode_number}: ${episode.title}`,
                tag: `episode-${episode.id}`,
                data: { url: `/watch/${episode.id}` },
              });
            }, i * 1500);
          });
        }
      } else {
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

          relevantEpisodes.slice(0, 3).forEach((episode: any, i: number) => {
            setTimeout(() => {
              sendNotification(`New Episode: ${episode.season?.anime?.title}`, {
                body: `Episode ${episode.episode_number}: ${episode.title}`,
                tag: `episode-${episode.id}`,
                data: { url: `/watch/${episode.id}` },
              });
            }, i * 1500);
          });
        }
      }

      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Error checking new episodes:', error);
    } finally {
      setIsChecking(false);
    }
  }, [user, permission, sendNotification, isChecking, settings]);

  // Set up periodic checking
  useEffect(() => {
    if (permission === 'granted' && user && settings.newEpisodes) {
      checkNewEpisodes();
      checkIntervalRef.current = setInterval(checkNewEpisodes, CHECK_INTERVAL);
      
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
  }, [permission, user, checkNewEpisodes, settings.newEpisodes]);

  // Real-time subscription for instant notifications
  useEffect(() => {
    if (permission !== 'granted' || !user || !settings.newEpisodes) return;

    const channel = supabase
      .channel('new-episodes-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'episodes',
        },
        async (payload) => {
          if (!settings.favorites) {
            const episode = payload.new;
            const { data: season } = await supabase
              .from('seasons')
              .select('anime:anime_id(id, title)')
              .eq('id', episode.season_id)
              .single();

            if (season?.anime) {
              sendNotification(`New Episode: ${(season.anime as any).title}`, {
                body: `Episode ${episode.episode_number}: ${episode.title}`,
                tag: `episode-${episode.id}`,
                data: { url: `/watch/${episode.id}` },
              });
            }
            return;
          }

          const { data: favorites } = await supabase
            .from('user_favorites')
            .select('anime_id')
            .eq('user_id', user.id);

          if (!favorites) return;

          const episode = payload.new;
          
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
  }, [permission, user, sendNotification, settings]);

  return {
    isSupported,
    permission,
    settings,
    updateSettings,
    requestPermission,
    sendNotification,
    checkNewEpisodes,
    isChecking,
  };
}
