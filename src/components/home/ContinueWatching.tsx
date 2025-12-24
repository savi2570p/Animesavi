import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, ChevronRight, Clock, Sparkles } from 'lucide-react';

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
  anime: Anime;
  episode: Episode;
  progress: number | null;
  watched_at: string;
}

export function ContinueWatching() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRecentHistory();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchRecentHistory = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('watch_history')
      .select('*, anime:anime_id(*), episode:episode_id(*)')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .order('watched_at', { ascending: false })
      .limit(6);

    if (data) {
      setHistory(data as WatchHistoryItem[]);
    }
    setIsLoading(false);
  };

  const formatTimeLeft = (progress: number | null, duration: number | null) => {
    if (!progress || !duration) return null;
    const remaining = Math.max(0, duration - (duration * progress / 100));
    const minutes = Math.floor(remaining / 60);
    return `${minutes}m left`;
  };

  if (!user || (!isLoading && history.length === 0)) return null;

  if (isLoading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 bg-primary/20 rounded-lg animate-pulse" />
            <div className="h-8 w-56 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-video bg-muted animate-pulse rounded-xl skeleton-shimmer" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="container relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Continue Watching
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pick up where you left off</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            asChild 
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 group"
          >
            <Link to="/history" className="flex items-center gap-1">
              View all 
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
          {history.map((item, index) => (
            <Link
              key={item.id}
              to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
              className="group relative"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="anime-card opacity-0 animate-fade-in">
                {/* Thumbnail container */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/50 border border-border/50 group-hover:border-primary/50 transition-all duration-500">
                  <img
                    src={item.anime.cover_image || '/placeholder.svg'}
                    alt={item.anime.title}
                    className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl scale-150 animate-pulse" />
                      <div className="relative w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50 transform group-hover:scale-110 transition-transform duration-300">
                        <Play className="h-6 w-6 text-primary-foreground fill-current ml-1" />
                      </div>
                    </div>
                  </div>

                  {/* Time remaining badge */}
                  {formatTimeLeft(item.progress, item.episode.duration) && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white/90 border border-white/10">
                      {formatTimeLeft(item.progress, item.episode.duration)}
                    </div>
                  )}

                  {/* Episode number badge */}
                  <div className="absolute bottom-12 left-3 px-2 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">
                    EP {item.episode.episode_number}
                  </div>

                  {/* Premium progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 backdrop-blur-sm">
                    <div className="relative h-full overflow-hidden">
                      {/* Background track */}
                      <div className="absolute inset-0 bg-white/10" />
                      
                      {/* Progress fill with glow */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(item.progress || 0, 100)}%` }}
                      >
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine" />
                        
                        {/* Glow at the end */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full blur-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info section */}
                <div className="p-3 space-y-1">
                  <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors duration-300">
                    {item.anime.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.episode.title || `Episode ${item.episode.episode_number}`}
                    </p>
                    <span className="text-[10px] text-primary font-medium">
                      {Math.round(item.progress || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
