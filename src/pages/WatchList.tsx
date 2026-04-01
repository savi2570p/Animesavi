import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Clock, Play, Trash2, ListVideo } from 'lucide-react';

interface WatchListItem {
  id: string;
  episode_id: string;
  created_at: string;
  episode?: {
    id: string;
    title: string;
    episode_number: number;
    thumbnail: string | null;
    duration: number | null;
    season?: {
      season_number: number;
      anime?: {
        id: string;
        title: string;
        cover_image: string | null;
      };
    };
  };
}

export default function WatchList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWatchList();
  }, [user, navigate]);

  const fetchWatchList = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('watch_later')
      .select(`
        id, episode_id, created_at,
        episodes!watch_later_episode_id_fkey (
          id, title, episode_number, thumbnail, duration,
          seasons!episodes_season_id_fkey (
            season_number,
            anime!seasons_anime_id_fkey ( id, title, cover_image )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = data.map((item: any) => ({
        id: item.id,
        episode_id: item.episode_id,
        created_at: item.created_at,
        episode: item.episodes ? {
          ...item.episodes,
          season: item.episodes.seasons ? {
            ...item.episodes.seasons,
            anime: item.episodes.seasons.anime,
          } : undefined,
        } : undefined,
      }));
      setItems(mapped);
    }
    if (error) console.error('Error fetching watch list:', error);
    setIsLoading(false);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('watch_later').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Removed from Watch List');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  if (!user) return null;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <ListVideo className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-heading font-bold">Watch List</h1>
        <span className="text-sm text-muted-foreground ml-2">({items.length})</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <ListVideo className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your Watch List is empty</h2>
          <p className="text-muted-foreground mb-6">Add episodes to your watch list from any anime detail page</p>
          <Button asChild>
            <Link to="/browse">Browse Anime</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const ep = item.episode;
            const anime = ep?.season?.anime;
            const img = ep?.thumbnail || anime?.cover_image || '/placeholder.svg';

            return (
              <Card key={item.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                <Link to={`/watch/${item.episode_id}`} className="flex gap-3 p-3">
                  <div className="relative w-28 h-20 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={img} alt={ep?.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                    {ep?.duration && (
                      <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                        {formatDuration(ep.duration)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-medium truncate">{anime?.title}</p>
                    <p className="text-sm font-semibold truncate mt-0.5">
                      S{ep?.season?.season_number || 1} EP{ep?.episode_number} - {ep?.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <div className="px-3 pb-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
