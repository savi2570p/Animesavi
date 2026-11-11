import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Trash2, Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, formatNotificationTime } from '@/hooks/useNotifications';

export default function Notifications() {
  const { user, loading } = useAuth() as ReturnType<typeof useAuth> & { loading?: boolean };
  const { notifications, unreadCount, isLoading, markAllRead, clearAll } = useNotifications();

  // Opening the page marks queued alerts as read.
  useEffect(() => {
    if (unreadCount > 0) markAllRead();
  }, [unreadCount, markAllRead]);

  return (
    <div className="container max-w-3xl py-6 md:py-10">
      <SEO title="Notifications | AnimeSavi+" description="New episodes from your favorite anime." path="/notifications" />
      <header className="flex items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl md:text-3xl font-bold flex items-center gap-2"><Bell className="h-6 w-6 text-primary" />Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">New episodes from your favorites</p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll} className="shrink-0 gap-1.5 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />Clear all
          </Button>
        )}
      </header>

      {!user && !loading ? (
        <div className="py-16 text-center">
          <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-semibold">Sign in to see your notifications</p>
          <Button asChild size="sm" className="mt-4"><Link to="/auth">Sign In</Link></Button>
        </div>
      ) : isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-3"><Skeleton className="h-20 w-14 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-semibold">No new episodes</p>
          <p className="mt-1 text-sm text-muted-foreground">Add anime to your favorites to get notified when new episodes arrive.</p>
          <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5"><Link to="/favorites"><Heart className="h-3.5 w-3.5" />My favorites</Link></Button>
        </div>
      ) : (
        <ul className="divide-y divide-border" aria-label="Notifications">
          {notifications.map((n) => (
            <li key={n.id}>
              <Link to={n.link} className="notif-page-item group flex items-center gap-3 py-3 px-2 -mx-2 rounded-md">
                <div className="w-14 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                  <img src={n.cover_image || '/placeholder.svg'} alt={n.anime_title} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{n.anime_title}</p>
                  <p className="mt-0.5 text-xs text-primary">
                    {n.episode_number != null ? `S${n.season_number} E${n.episode_number} released` : 'New episode available'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatNotificationTime(n.created_at)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
