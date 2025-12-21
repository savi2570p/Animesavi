import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, ChevronRight } from 'lucide-react';

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
}

export function ContinueWatching() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    if (user) {
      fetchRecentHistory();
    }
  }, [user]);

  const fetchRecentHistory = async () => {
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
  };

  if (!user || history.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-heading font-bold">Continue Watching</h2>
          <Button variant="ghost" asChild>
            <Link to="/history" className="text-muted-foreground hover:text-foreground">
              See all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {history.map((item) => (
            <Link
              key={item.id}
              to={`/watch/${item.episode.id}`}
              className="anime-card group"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={item.anime.cover_image || '/placeholder.svg'}
                  alt={item.anime.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-10 w-10 text-white fill-current" />
                </div>
              </div>
              <div className="p-2">
                <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                  {item.anime.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  EP {item.episode.episode_number}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
