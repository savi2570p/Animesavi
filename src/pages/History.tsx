import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { History as HistoryIcon, Play, Clock, Trash2 } from 'lucide-react';
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

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchHistory();
  }, [user]);

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

  const deleteHistoryItem = async (historyId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { error } = await supabase
      .from('watch_history')
      .delete()
      .eq('id', historyId);

    if (error) {
      toast.error('Failed to delete history item');
    } else {
      setHistory(history.filter((item) => item.id !== historyId));
      toast.success('Removed from history');
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
        <div className="space-y-4">
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
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="self-center">
                  <Play className="h-4 w-4 mr-1 fill-current" />
                  Continue
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
