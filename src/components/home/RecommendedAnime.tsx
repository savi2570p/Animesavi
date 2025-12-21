import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Play, ChevronRight, Star } from 'lucide-react';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[];
  status: string | null;
  view_count: number | null;
  release_year: number | null;
}

export function RecommendedAnime() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [topGenres, setTopGenres] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    } else {
      fetchPopular();
    }
  }, [user]);

  const fetchRecommendations = async () => {
    // Get user's top genres
    const { data: prefs } = await supabase
      .from('user_genre_preferences')
      .select('genre, watch_count')
      .eq('user_id', user!.id)
      .order('watch_count', { ascending: false })
      .limit(3);

    if (prefs && prefs.length > 0) {
      const genres = prefs.map((p) => p.genre);
      setTopGenres(genres);

      // Get watched anime IDs to exclude
      const { data: watchedData } = await supabase
        .from('watch_history')
        .select('anime_id')
        .eq('user_id', user!.id);

      const watchedIds = watchedData?.map((w) => w.anime_id) || [];

      // Get recommendations based on genres
      let query = supabase
        .from('anime')
        .select('*')
        .overlaps('genres', genres)
        .order('view_count', { ascending: false })
        .limit(12);

      if (watchedIds.length > 0) {
        query = query.not('id', 'in', `(${watchedIds.join(',')})`);
      }

      const { data } = await query;
      if (data) {
        setRecommendations(data);
      }
    } else {
      fetchPopular();
    }
  };

  const fetchPopular = async () => {
    const { data } = await supabase
      .from('anime')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(12);

    if (data) {
      setRecommendations(data);
    }
  };

  if (recommendations.length === 0) return null;

  return (
    <section className="py-12 bg-card/30">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold">
                {user ? 'Recommended For You' : 'Popular Anime'}
              </h2>
              {topGenres.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Based on your love for {topGenres.join(', ')}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/browse" className="text-muted-foreground hover:text-foreground">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {recommendations.map((anime) => (
            <Link key={anime.id} to={`/anime/${anime.id}`} className="anime-card group">
              <div className="aspect-[3/4] relative overflow-hidden rounded-xl">
                <img
                  src={anime.cover_image || '/placeholder.svg'}
                  alt={anime.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <Button size="sm" className="w-full anime-button text-xs">
                      <Play className="h-3 w-3 mr-1 fill-current" /> Watch
                    </Button>
                  </div>
                </div>
                {anime.status === 'ongoing' && (
                  <Badge className="absolute top-2 left-2 bg-anime-orange text-xs">
                    Ongoing
                  </Badge>
                )}
              </div>
              <div className="p-2">
                <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                  {anime.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {anime.release_year && <span>{anime.release_year}</span>}
                  {anime.view_count !== null && anime.view_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-anime-orange text-anime-orange" />
                        {anime.view_count}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
