import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[];
  status: string | null;
}

interface Favorite {
  id: string;
  anime_id: string;
  created_at: string;
  anime: Anime;
}

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchFavorites();
  }, [user]);

  const fetchFavorites = async () => {
    const { data } = await supabase
      .from('user_favorites')
      .select('*, anime:anime_id(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      setFavorites(data as Favorite[]);
    }
    setIsLoading(false);
  };

  const removeFavorite = async (favoriteId: string) => {
    const { error } = await supabase.from('user_favorites').delete().eq('id', favoriteId);

    if (error) {
      toast.error('Failed to remove from favorites');
    } else {
      setFavorites(favorites.filter((f) => f.id !== favoriteId));
      toast.success('Removed from favorites');
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-heading font-bold mb-8">My Favorites</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="h-8 w-8 text-anime-pink fill-anime-pink" />
        <h1 className="text-3xl font-heading font-bold">
          My <span className="anime-gradient-text">Favorites</span>
        </h1>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No favorites yet</h2>
          <p className="text-muted-foreground mb-6">
            Start adding anime to your favorites to see them here
          </p>
          <Button asChild className="anime-button">
            <Link to="/browse">Browse Anime</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {favorites.map((favorite) => (
            <div key={favorite.id} className="anime-card group relative">
              <Link to={`/anime/${favorite.anime.id}`}>
                <div className="aspect-[3/4] relative overflow-hidden rounded-xl">
                  <img
                    src={favorite.anime.cover_image || '/placeholder.svg'}
                    alt={favorite.anime.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <Button size="sm" className="w-full anime-button">
                        <Play className="h-4 w-4 mr-2 fill-current" /> Watch
                      </Button>
                    </div>
                  </div>
                  {favorite.anime.status === 'ongoing' && (
                    <Badge className="absolute top-2 left-2 bg-anime-orange">Ongoing</Badge>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {favorite.anime.title}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFavorite(favorite.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
