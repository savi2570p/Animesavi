import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, X, Clock } from 'lucide-react';

const NOTIFICATION_KEY = 'continue_watching_notification_shown';

interface WatchHistoryItem {
  id: string;
  anime: {
    id: string;
    title: string;
    cover_image: string | null;
  };
  episode: {
    id: string;
    title: string;
    episode_number: number;
    thumbnail: string | null;
    season_id: string;
  };
  progress: number | null;
  watched_at: string;
  season?: {
    season_number: number;
  };
}

export function ContinueWatchingNotification() {
  const { user } = useAuth();
  const [lastWatched, setLastWatched] = useState<WatchHistoryItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Check if notification was already shown in this session
    const sessionShown = sessionStorage.getItem(NOTIFICATION_KEY);
    if (sessionShown === 'true') return;

    fetchLastWatched();
  }, [user]);

  const fetchLastWatched = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('watch_history')
      .select('*, anime:anime_id(*), episode:episode_id(*)')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single();

    if (data && data.anime && data.episode && data.progress && data.progress > 5 && data.progress < 95) {
      // Fetch season info
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('id', (data.episode as any).season_id)
        .single();

      setLastWatched({
        ...data,
        season: seasonData || undefined,
      } as WatchHistoryItem);

      // Show notification after a short delay
      setTimeout(() => setIsVisible(true), 1500);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(NOTIFICATION_KEY, 'true');
  };

  const handleResume = () => {
    sessionStorage.setItem(NOTIFICATION_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible || !lastWatched) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-slide-in-up">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-primary/10">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" />
            Continue Watching
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0">
              <img
                src={lastWatched.episode.thumbnail || lastWatched.anime.cover_image || '/placeholder.svg'}
                alt={lastWatched.anime.title}
                className="w-full h-full object-cover"
              />
              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${lastWatched.progress || 0}%` }}
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-1">{lastWatched.anime.title}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                S{lastWatched.season?.season_number || 1} E{lastWatched.episode.episode_number} • {Math.round(lastWatched.progress || 0)}% watched
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="flex-1 text-xs"
            >
              Not Now
            </Button>
            <Button
              size="sm"
              asChild
              onClick={handleResume}
              className="flex-1 anime-button text-xs"
            >
              <Link to={`/watch/${lastWatched.episode.id}?t=${lastWatched.progress || 0}`}>
                <Play className="h-3 w-3 mr-1 fill-current" />
                Resume
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}