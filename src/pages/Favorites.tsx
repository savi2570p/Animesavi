import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Play, Trash2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { ShareCollectionDialog } from '@/components/ShareCollectionDialog';
import { PosterCard } from '@/components/anime/PosterCard';

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
  const [shareOpen, setShareOpen] = useState(false);

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
        <div className="browse-ra-grid">
          {favorites.map((favorite) => (
            <div key={favorite.id} className="poster-card-shell group relative">
              <PosterCard to={`/anime/${favorite.anime.id}`} title={favorite.anime.title} cover={favorite.anime.cover_image}
                genres={favorite.anime.genres} status={favorite.anime.status} fluid />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${favorite.anime.title} from favorites`}
                className="poster-card-remove"
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
