import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { History as HistoryIcon, Play, Clock, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  duration: number | null;
}

interface WatchHistoryItem {
  id: string;
  watched_at: string;
  progress: number | null;
  completed: boolean | null;
  anime: Anime;
  episode: Episode;
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchHistory();
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select(`
          id,
          watched_at,
          progress,
          completed,
          anime_id,
          episode_id
        `)
        .eq('user_id', user!.id)
        .order('watched_at', { ascending: false });

      if (error) {
        console.error('Error fetching watch history:', error);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Fetch anime data separately
        const animeIds = [...new Set(data.map(h => h.anime_id))];
        const episodeIds = [...new Set(data.map(h => h.episode_id))];

        const [animeResponse, episodeResponse] = await Promise.all([
          supabase.from('anime').select('id, title, cover_image').in('id', animeIds),
          supabase.from('episodes').select('id, title, episode_number, duration').in('id', episodeIds)
        ]);

        const animeMap = new Map(animeResponse.data?.map(a => [a.id, a]) || []);
        const episodeMap = new Map(episodeResponse.data?.map(e => [e.id, e]) || []);

        const historyWithDetails = data.map(h => ({
          id: h.id,
          watched_at: h.watched_at,
          progress: h.progress,
          completed: h.completed,
          anime: animeMap.get(h.anime_id) || { id: h.anime_id, title: 'Unknown', cover_image: null },
          episode: episodeMap.get(h.episode_id) || { id: h.episode_id, title: 'Unknown', episode_number: 0, duration: null }
        }));

        setHistory(historyWithDetails as WatchHistoryItem[]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
    setIsLoading(false);
  };

  const deleteHistoryItem = async (historyId: string, e: React.MouseEvent | React.TouchEvent) => {
    // Critical: Stop event propagation to prevent card navigation
    e.preventDefault();
    e.stopPropagation();
    
    // For touch events on mobile, we need extra protection
    if ('nativeEvent' in e && e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }

    try {
      const { error } = await supabase
        .from('watch_history')
        .delete()
        .eq('id', historyId);

      if (error) {
        toast.error('Failed to delete history item');
      } else {
        setHistory(prev => prev.filter((item) => item.id !== historyId));
        toast.success('Removed from history');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete history item');
    }
  };

  const clearAllHistory = async () => {
    const { error } = await supabase
      .from('watch_history')
      .delete()
      .eq('user_id', user!.id);

    if (error) {
      toast.error('Failed to clear history');
    } else {
      setHistory([]);
      toast.success('Watch history cleared');
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count > 0) {
        return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  };

  const formatWatchedTime = (progress: number | null, duration: number | null) => {
    if (!progress || !duration) return null;
    const watchedSeconds = (progress / 100) * duration;
    const minutes = Math.floor(watchedSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m watched`;
    }
    return `${minutes}m watched`;
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-heading font-bold mb-8">Watch History</h1>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {/* User Profile Avatar */}
          <Avatar className="h-10 w-10 border-2 border-primary/30">
            <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.username || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {userProfile?.username?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <HistoryIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-heading font-bold">
            Watch <span className="anime-gradient-text">History</span>
          </h1>
        </div>

        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Watch History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your watch history and remove all your progress data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20">
          <HistoryIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No watch history</h2>
          <p className="text-muted-foreground mb-6">
            Start watching anime to track your progress
          </p>
          <Button asChild className="anime-button">
            <Link to="/browse">Browse Anime</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block space-y-4">
            {history.map((item) => (
              <Link
                key={item.id}
                to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
                className="anime-card flex gap-4 p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={item.anime.cover_image || '/placeholder.svg'}
                    alt={item.anime.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-8 w-8 text-white fill-current" />
                  </div>
                  {/* Episode number badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">
                    EP {item.episode.episode_number}
                  </div>
                  {/* Complete watermark for finished anime */}
                  {item.completed && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-green-500/90 text-[10px] font-bold text-white">
                      COMPLETE
                    </div>
                  )}
                  {/* Progress overlay */}
                  {item.progress !== null && item.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0">
                      <Progress value={item.progress} className="h-1 rounded-none" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    {item.anime.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Episode {item.episode.episode_number}: {item.episode.title}
                  </p>
                  <div className="flex items-center flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(item.watched_at)}
                    </div>
                    {item.progress !== null && item.progress > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {item.completed ? 'Completed' : `${item.progress}% watched`}
                      </span>
                    )}
                    {formatWatchedTime(item.progress, item.episode.duration) && (
                      <span className="text-sm text-primary font-medium">
                        {formatWatchedTime(item.progress, item.episode.duration)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="self-center" asChild>
                    <Link to={`/watch/${item.episode.id}?t=${item.progress || 0}`} onClick={(e) => e.stopPropagation()}>
                      <Play className="h-4 w-4 mr-1 fill-current" />
                      Continue
                    </Link>
                  </Button>
                  <div className="w-px h-6 bg-border" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    onTouchStart={(e) => e.stopPropagation()}
                    type="button"
                    title="Remove from history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>

          {/* Mobile View - Compact grid with thumbnail and progress only */}
          <div className="md:hidden grid grid-cols-2 sm:grid-cols-3 gap-3">
            {history.map((item) => (
              <Link
                key={item.id}
                to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
                className="relative group"
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={item.anime.cover_image || '/placeholder.svg'}
                    alt={item.anime.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Play overlay on hover/tap */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-active:opacity-100 transition-opacity">
                    <Play className="h-8 w-8 text-white fill-current" />
                  </div>
                  {/* Episode badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">
                    EP {item.episode.episode_number}
                  </div>
                  {/* Complete watermark for finished anime */}
                  {item.completed && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-green-500/90 text-[8px] font-bold text-white">
                      COMPLETE
                    </div>
                  )}
                  {/* Delete button - moved to bottom right when not completed */}
                  {!item.completed && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1 right-1 h-6 w-6 text-white/80 hover:text-destructive bg-black/40 hover:bg-black/60 z-10"
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  {/* Progress bar at bottom */}
                  {item.progress !== null && item.progress > 0 && !item.completed && (
                    <div className="absolute bottom-0 left-0 right-0">
                      <Progress value={item.progress} className="h-1.5 rounded-none" />
                    </div>
                  )}
                </div>
                {/* Title below thumbnail - 2 lines max */}
                <p className="mt-1.5 text-xs font-medium line-clamp-2 leading-tight">
                  {item.anime.title}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
