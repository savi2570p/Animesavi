import { useState, useEffect } from 'react';
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
  anime_id: string;
  anime_title: string;
  cover_image: string | null;
  episode_number: number;
  season_number: number;
  episode_id: string;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Get user's favorited anime
      const { data: favorites } = await supabase
        .from('user_favorites')
        .select('anime_id')
        .eq('user_id', user.id);

      if (!favorites || favorites.length === 0) {
        setNotifications([]);
        return;
      }

      const animeIds = favorites.map(f => f.anime_id);

      // Get recent episodes from favorited anime (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentEpisodes } = await supabase
        .from('episodes')
        .select(`
          id,
          episode_number,
          created_at,
          season:season_id (
            id,
            season_number,
            anime:anime_id (
              id,
              title,
              cover_image
            )
          )
        `)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentEpisodes) {
        const filteredNotifications: Notification[] = recentEpisodes
          .filter((ep: any) => ep.season?.anime && animeIds.includes(ep.season.anime.id))
          .map((ep: any) => ({
            id: ep.id,
            anime_id: ep.season.anime.id,
            anime_title: ep.season.anime.title,
            cover_image: ep.season.anime.cover_image,
            episode_number: ep.episode_number,
            season_number: ep.season.season_number,
            episode_id: ep.id,
            created_at: ep.created_at,
          }));

        setNotifications(filteredNotifications);
        
        // Count notifications from last 24 hours as "unread"
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const unread = filteredNotifications.filter(
          n => new Date(n.created_at) > oneDayAgo
        ).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-primary/10"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-h-96 overflow-y-auto bg-popover/95 backdrop-blur-xl border-border/50"
      >
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Notifications</h3>
            <p className="text-xs text-muted-foreground">New episodes from your favorites</p>
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearNotifications}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
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
                <Link
                  to={`/watch/${notification.episode_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src={notification.cover_image || '/placeholder.svg'} 
                      alt={notification.anime_title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{notification.anime_title}</p>
                    <p className="text-xs text-primary">
                      S{notification.season_number} E{notification.episode_number} released
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50">
            <Link 
              to="/favorites" 
              className="text-xs text-primary hover:underline"
              onClick={() => setIsOpen(false)}
            >
              View all favorites →
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
