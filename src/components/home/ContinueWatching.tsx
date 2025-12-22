import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, ChevronRight, Clock } from 'lucide-react';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
}

interface WatchHistoryItem {
  id: string;
  anime: Anime;
  episode: Episode;
  progress: number | null;
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

  if (!user || (!isLoading && history.length === 0)) return null;

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container">
          <div className="h-7 w-48 bg-muted animate-pulse rounded mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-10">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-bold">Continue Watching</h2>
          </div>
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/history" className="flex items-center">
              See all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {history.map((item, index) => (
            <Link
              key={item.id}
              to={`/watch/${item.episode.id}`}
              className={`anime-card group stagger-${Math.min(index + 1, 6)} opacity-0 animate-fade-in`}
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={item.anime.cover_image || '/placeholder.svg'}
                  alt={item.anime.title}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  loading="lazy"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-white fill-current ml-0.5" />
                  </div>
                </div>
                {/* Progress bar */}
                {item.progress && item.progress > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/50">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors duration-200">
                  {item.anime.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Episode {item.episode.episode_number}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
