import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Play, ChevronRight, CalendarClock } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    } else {
      fetchPopular();
    }
  }, [user]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    const { data: prefs } = await supabase
      .from('user_genre_preferences')
      .select('genre, watch_count')
      .eq('user_id', user!.id)
      .order('watch_count', { ascending: false })
      .limit(3);

    if (prefs && prefs.length > 0) {
      const genres = prefs.map((p) => p.genre);
      setTopGenres(genres);

      const { data: watchedData } = await supabase
        .from('watch_history')
        .select('anime_id')
        .eq('user_id', user!.id);

      const watchedIds = watchedData?.map((w) => w.anime_id) || [];

      // Use anime_public view to avoid exposing uploader_id
      let query = supabase
        .from('anime_public')
        .select('*')
        .overlaps('genres', genres)
        .order('view_count', { ascending: false })
        .limit(12);

      if (watchedIds.length > 0) {
        query = query.not('id', 'in', `(${watchedIds.join(',')})`);
      }

      const { data } = await query;
      if (data) {
        // Randomize the results
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setRecommendations(shuffled);
      }
    } else {
      fetchPopular();
    }
    setIsLoading(false);
  };

  const fetchPopular = async () => {
    setIsLoading(true);
    // Use anime_public view to avoid exposing uploader_id
    const { data } = await supabase
      .from('anime_public')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(12);

    if (data) {
      // Randomize the results
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setRecommendations(shuffled);
    }
    setIsLoading(false);
  };


  if (isLoading) {
    return (
      <section className="py-12 bg-card/30">
        <div className="container">
          <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="py-12 bg-card/30">
      <div className="container">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-primary shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-heading font-bold">
                {user ? 'Recommended For You' : 'Popular Anime'}
              </h2>
              {topGenres.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Based on your love for {topGenres.join(', ')}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/browse" className="flex items-center">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Anime Row - Horizontal scroll on all devices */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {recommendations.map((anime, index) => (
            <AnimeCardContextMenu
              key={anime.id}
              animeTitle={anime.title || ''}
              animeUrl={`/anime/${anime.id}`}
              coverImage={anime.cover_image}
            >
              <Link 
                to={`/anime/${anime.id}`} 
                className={`anime-card group stagger-${Math.min(index + 1, 6)} opacity-0 animate-fade-in w-[120px] md:w-[140px] shrink-0`}
              >
                <div className="aspect-[3/4] relative overflow-hidden rounded-lg">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title || ''}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* 4K Badge */}
                  <div className="absolute bottom-1.5 right-1.5 z-10">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">4K</span>
                  </div>
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <Button size="sm" className="w-full anime-button text-xs py-2">
                        <Play className="h-3 w-3 mr-1.5 fill-current" /> Watch Now
                      </Button>
                    </div>
                  </div>
                  {/* Status Badge */}
                  {anime.status === 'ongoing' && (
                    <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Ongoing
                    </Badge>
                  )}
                  {/* Coming Soon Badge for upcoming */}
                  {anime.status === 'upcoming' && (
                    <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                      <CalendarClock className="h-3 w-3" />
                      Coming Soon
                    </Badge>
                  )}
                  {/* Token Crown Badge */}
                  <TokenCrownBadge />
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors duration-200">
                    {anime.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    {anime.release_year && <span>{anime.release_year}</span>}
                    {anime.genres && anime.genres.length > 0 && (
                      <>
                        {anime.release_year && <span>•</span>}
                        <span className="text-primary/80">{anime.genres[0]}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
}
