import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Bell, Wifi } from 'lucide-react';

interface NewEpisode {
  id: string;
  title: string;
  anime_title: string;
  anime_id: string;
  episode_number: number;
  season_number: number;
}

export function useBackgroundSync() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [newEpisodes, setNewEpisodes] = useState<NewEpisode[]>([]);
  const hasJustCameOnline = useRef(false);
  const isSyncingRef = useRef(false);

  const checkForNewEpisodes = useCallback(async () => {
    if (!user || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      // Get user's favorites
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('anime_id')
        .eq('user_id', user.id);

      if (!favorites || favorites.length === 0) {
        isSyncingRef.current = false;
        setIsSyncing(false);
        return;
      }

      const favoriteIds = favorites.map(f => f.anime_id);

      // Get last check time from localStorage
      const lastCheckStr = localStorage.getItem('lastBackgroundSync');
      const lastCheck = lastCheckStr ? new Date(lastCheckStr) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get seasons for favorite anime
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, anime_id, season_number')
        .in('anime_id', favoriteIds);

      if (!seasons || seasons.length === 0) {
        isSyncingRef.current = false;
        setIsSyncing(false);
        return;
      }

      const seasonIds = seasons.map(s => s.id);

      // Find episodes uploaded since last check
      const { data: episodes } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          episode_number,
          season_id,
          created_at
        `)
        .in('season_id', seasonIds)
        .gt('created_at', lastCheck.toISOString())
        .order('created_at', { ascending: false });

      if (episodes && episodes.length > 0) {
        // Get anime titles
        const { data: animeData } = await supabase
          .from('anime')
          .select('id, title')
          .in('id', favoriteIds);

        const animeMap = new Map(animeData?.map(a => [a.id, a.title]) || []);
        const seasonMap = new Map(seasons.map(s => [s.id, { anime_id: s.anime_id, season_number: s.season_number }]));

        const newEps: NewEpisode[] = episodes.map(ep => {
          const seasonInfo = seasonMap.get(ep.season_id);
          return {
            id: ep.id,
            title: ep.title,
            anime_title: animeMap.get(seasonInfo?.anime_id || '') || 'Unknown',
            anime_id: seasonInfo?.anime_id || '',
            episode_number: ep.episode_number,
            season_number: seasonInfo?.season_number || 1
          };
        });

        setNewEpisodes(newEps);

        // Show notification if we just came online
        if (hasJustCameOnline.current && newEps.length > 0) {
          toast.success(
            `${newEps.length} new episode${newEps.length > 1 ? 's' : ''} available!`,
            {
              description: newEps.slice(0, 3).map(ep => `${ep.anime_title} - EP ${ep.episode_number}`).join(', '),
              duration: 8000,
              action: {
                label: 'View',
                onClick: () => window.location.href = `/watch/${newEps[0].id}`
              }
            }
          );
        }
      }

      // Update last sync time
      const now = new Date();
      localStorage.setItem('lastBackgroundSync', now.toISOString());
      setLastSyncTime(now);
      hasJustCameOnline.current = false;

    } catch (error) {
      console.error('Background sync error:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [user]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      hasJustCameOnline.current = true;
      
      toast.success("You're back online!", {
        description: 'Checking for new episodes...',
        duration: 3000
      });

      // Trigger sync after a short delay
      setTimeout(() => {
        checkForNewEpisodes();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkForNewEpisodes]);

  // Initial sync on mount
  useEffect(() => {
    if (user && isOnline) {
      checkForNewEpisodes();
    }
  }, [user]);

  // Periodic sync every 15 minutes when online
  useEffect(() => {
    if (!user || !isOnline) return;

    const interval = setInterval(() => {
      checkForNewEpisodes();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [user, isOnline, checkForNewEpisodes]);

  // Register for background sync if supported
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration: ServiceWorkerRegistration) => {
        // Background Sync API - check if sync is available
        if ('sync' in registration) {
          (registration as any).sync?.register('check-new-episodes').catch((err: Error) => {
            console.log('Background sync registration failed:', err);
          });
        }
      });
    }
  }, []);

  const clearNewEpisodes = useCallback(() => {
    setNewEpisodes([]);
  }, []);

  const manualSync = useCallback(() => {
    if (isOnline) {
      hasJustCameOnline.current = true;
      checkForNewEpisodes();
    } else {
      toast.error("You're offline. Sync will happen when connection is restored.");
    }
  }, [isOnline, checkForNewEpisodes]);

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    newEpisodes,
    clearNewEpisodes,
    manualSync
  };
}
