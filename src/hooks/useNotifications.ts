import { useCallback, useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  anime_id: string | null;
  anime_title: string;
  cover_image: string | null;
  episode_number: number | null;
  season_number: number | null;
  episode_id: string | null;
  created_at: string;
  link: string;
  is_read: boolean;
  source: 'queue' | 'episode';
}

const clearedKey = (userId: string) => `cleared_notifications_${userId}`;

async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  // 1. Push-delivered / queued notifications
  const { data: queue } = await supabase
    .from('notification_queue')
    .select('id, anime_id, episode_id, title, body, image_url, link, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  const queueItems: AppNotification[] = (queue || []).map((q: any) => ({
    id: q.id,
    anime_id: q.anime_id,
    anime_title: q.body || 'New Episode',
    cover_image: q.image_url,
    episode_number: null,
    season_number: null,
    episode_id: q.episode_id,
    created_at: q.created_at,
    link: q.link || (q.episode_id ? `/watch/${q.episode_id}` : '/'),
    is_read: q.is_read,
    source: 'queue',
  }));

  // Older queued alerts stored the episode banner; always show the anime poster instead.
  const queueAnimeIds = [...new Set(queueItems.map((q) => q.anime_id).filter(Boolean))] as string[];
  if (queueAnimeIds.length > 0) {
    const { data: posters } = await supabase.from('anime').select('id, cover_image').in('id', queueAnimeIds);
    const posterById = new Map((posters || []).map((a: any) => [a.id, a.cover_image as string | null]));
    queueItems.forEach((q) => {
      const poster = q.anime_id ? posterById.get(q.anime_id) : null;
      if (poster) q.cover_image = poster;
    });
  }

  // 2. Recent favorited episodes (legacy fallback)
  const { data: favorites } = await supabase.from('user_favorites').select('anime_id').eq('user_id', userId);

  let episodeItems: AppNotification[] = [];
  if (favorites && favorites.length > 0) {
    const animeIds = favorites.map((f) => f.anime_id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recent } = await supabase
      .from('episodes')
      .select(`id, episode_number, created_at, season:season_id (id, season_number, anime:anime_id (id, title, cover_image))`)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    const cleared: string[] = JSON.parse(localStorage.getItem(clearedKey(userId)) || '[]');
    const queueEpisodeIds = new Set(queueItems.map((q) => q.episode_id).filter(Boolean));

    episodeItems = (recent || [])
      .filter((ep: any) => ep.season?.anime && animeIds.includes(ep.season.anime.id))
      .filter((ep: any) => !cleared.includes(ep.id) && !queueEpisodeIds.has(ep.id))
      .map((ep: any) => ({
        id: `ep-${ep.id}`,
        anime_id: ep.season.anime.id,
        anime_title: ep.season.anime.title,
        cover_image: ep.season.anime.cover_image,
        episode_number: ep.episode_number,
        season_number: ep.season.season_number,
        episode_id: ep.id,
        created_at: ep.created_at,
        link: `/watch/${ep.id}`,
        is_read: true,
        source: 'episode',
      }));
  }

  return [...queueItems, ...episodeItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);
}

/**
 * Shared notification feed for the header badge and the dedicated Notifications page.
 * One query cache keeps the unread count in sync wherever it is shown.
 */
export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useId();
  const queryKey = ['notifications', user?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Realtime updates for new push deliveries
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-queue-${user.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_queue', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, instanceId]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => n.source === 'queue' && !n.is_read).length;

  const markAllRead = useCallback(async () => {
    if (!user) return;
    queryClient.setQueryData<AppNotification[]>(['notifications', user.id], (prev) =>
      (prev || []).map((n) => ({ ...n, is_read: true }))
    );
    await supabase.from('notification_queue').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  }, [user, queryClient]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await supabase.from('notification_queue').delete().eq('user_id', user.id);
    // Legacy episode notifications are hidden through a local cleared list.
    const cleared: string[] = JSON.parse(localStorage.getItem(clearedKey(user.id)) || '[]');
    const episodeIds = notifications.flatMap((n) => (n.source === 'episode' && n.episode_id ? [n.episode_id] : []));
    localStorage.setItem(clearedKey(user.id), JSON.stringify([...new Set([...cleared, ...episodeIds])]));
    queryClient.setQueryData<AppNotification[]>(['notifications', user.id], []);
  }, [user, queryClient, notifications]);

  return { notifications, unreadCount, isLoading: query.isLoading, markAllRead, clearAll };
}

export function formatNotificationTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
