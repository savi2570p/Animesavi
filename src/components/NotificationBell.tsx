import { useState, useEffect, useCallback } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Notification {
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

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Push-delivered / queued notifications
      const { data: queue } = await supabase
        .from('notification_queue')
        .select('id, anime_id, episode_id, title, body, image_url, link, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const queueItems: Notification[] = (queue || []).map((q: any) => ({
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

      // 2. Recent favorited episodes (legacy fallback)
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('anime_id')
        .eq('user_id', user.id);

      let episodeItems: Notification[] = [];
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

        const cleared: string[] = JSON.parse(localStorage.getItem(`cleared_notifications_${user.id}`) || '[]');
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

      const merged = [...queueItems, ...episodeItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);

      setNotifications(merged);
      setUnreadCount(queueItems.filter((q) => !q.is_read).length);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  // Realtime updates for new push deliveries
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-queue-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_queue', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const handleOpen = async (open: boolean) => {
    setIsOpen(open);
    if (open && user && unreadCount > 0) {
      await supabase.from('notification_queue').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setUnreadCount(0);
    }
  };

  const clearNotifications = async () => {
    if (!user) return;
    // Delete queue rows
    await supabase.from('notification_queue').delete().eq('user_id', user.id);
    // Mark legacy episode notifications as cleared in localStorage
    const cleared: string[] = JSON.parse(localStorage.getItem(`cleared_notifications_${user.id}`) || '[]');
    const all = [...new Set([...cleared, ...notifications.filter((n) => n.source === 'episode' && n.episode_id).map((n) => n.episode_id!)])];
    localStorage.setItem(`cleared_notifications_${user.id}`, JSON.stringify(all));
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-primary/10">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto bg-popover/95 backdrop-blur-xl border-border/50">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            <p className="text-xs text-muted-foreground">New episodes from your favorites</p>
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={clearNotifications}>
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No new episodes</p>
            <p className="text-xs">Add anime to favorites to get notified</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild className="p-0">
                <Link to={notification.link} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer" onClick={() => setIsOpen(false)}>
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img src={notification.cover_image || '/placeholder.svg'} alt={notification.anime_title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{notification.anime_title}</p>
                    {notification.episode_number != null ? (
                      <p className="text-xs text-primary">S{notification.season_number} E{notification.episode_number} released</p>
                    ) : (
                      <p className="text-xs text-primary">New episode available</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(notification.created_at)}</p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50">
            <Link to="/favorites" className="text-xs text-primary hover:underline" onClick={() => setIsOpen(false)}>
              View all favorites →
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
