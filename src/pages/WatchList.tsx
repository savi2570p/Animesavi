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
  animeId?: string;
  animeTitle?: string;
  coverImage?: string | null;
  totalSeasons?: number;
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
          id,
          seasons!episodes_season_id_fkey (
            season_number,
            anime!seasons_anime_id_fkey ( id, title, cover_image )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      // Deduplicate by anime and count seasons
      const animeMap = new Map<string, WatchListItem>();
      for (const item of data as any[]) {
        const anime = item.episodes?.seasons?.anime;
        if (!anime) continue;
        if (animeMap.has(anime.id)) continue;
        
        // Count total seasons for this anime
        const { count } = await supabase
          .from('seasons')
          .select('id', { count: 'exact', head: true })
          .eq('anime_id', anime.id);

        animeMap.set(anime.id, {
          id: item.id,
          episode_id: item.episode_id,
          created_at: item.created_at,
          animeId: anime.id,
          animeTitle: anime.title,
          coverImage: anime.cover_image,
          totalSeasons: count || 1,
        });
      }
      setItems(Array.from(animeMap.values()));
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

  if (!user) return null;

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <ListVideo className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-heading font-bold">Watch List</h1>
        <span className="text-sm text-muted-foreground ml-2">({items.length})</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <ListVideo className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your Watch List is empty</h2>
          <p className="text-muted-foreground mb-6">Add anime to your watch list from any anime detail page</p>
          <Button asChild>
            <Link to="/browse">Browse Anime</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => {
            const img = item.coverImage || '/placeholder.svg';

            return (
              <Card key={item.id} className="overflow-hidden group hover:border-primary/50 transition-colors rounded-xl">
                <Link to={`/anime/${item.animeId}`} className="block">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={img} alt={item.animeTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {/* Top-right H-DUB */}
                    <span className="absolute top-2 right-2 badge-glass-hdub">H-DUB</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-3 rounded-full bg-primary/90 shadow-lg">
                        <Play className="w-5 h-5 text-primary-foreground fill-current" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-sm font-semibold text-white line-clamp-2 drop-shadow-lg">
                        {item.animeTitle}
                      </h3>
                      <p className="text-xs text-white/70 mt-1">
                        {item.totalSeasons} Season{(item.totalSeasons || 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="p-2 flex justify-end">
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
