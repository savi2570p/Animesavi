import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Film, Clock, Star, ChevronRight, CalendarClock } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface Movie {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  created_at: string;
  view_count: number | null;
  status: string | null;
  firstEpisodeId?: string | null;
}

export function LatestMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchLatestMovies();
  }, []);

  const fetchLatestMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .eq('type', 'movie')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      
      // Fetch first episode for each movie
      const moviesWithEpisodes = await Promise.all(
        (data || []).map(async (movie) => {
          // Get the first season for this movie
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', movie.id)
            .order('season_number')
            .limit(1);
          
          if (seasons && seasons.length > 0) {
            // Get the first episode from the first season
            const { data: episodes } = await supabase
              .from('episodes')
              .select('id')
              .eq('season_id', seasons[0].id)
              .order('episode_number')
              .limit(1);
            
            return {
              ...movie,
              firstEpisodeId: episodes && episodes.length > 0 ? episodes[0].id : null
            };
          }
          
          return { ...movie, firstEpisodeId: null };
        })
      );
      
      setMovies(moviesWithEpisodes);
    } catch (error) {
      console.error('Error fetching latest movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14 bg-card/30">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-accent/10">
              <Film className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Movies</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (movies.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-card/30">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Film className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Movies</h2>
            <span className="px-2 py-1 text-xs font-medium bg-accent/20 text-accent rounded-full">
              New
            </span>
          </div>
          <Button asChild variant="ghost" className="group">
            <Link to="/latest-movies" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {(showAll ? movies : movies.slice(0, 4)).map((movie, index) => (
            <AnimeCardContextMenu
              key={movie.id}
              animeTitle={movie.title}
              animeUrl={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
              coverImage={movie.cover_image}
            >
              <Link
                to={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in gpu-accelerate w-[140px] md:w-auto shrink-0`}
              >
                {/* Poster with enhanced hover */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-3 shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.03] group-hover:-translate-y-2">
                  <img
                    src={movie.cover_image || '/placeholder.svg'}
                    alt={movie.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* 4K Badge */}
                  <div className="absolute bottom-1.5 right-1.5 z-10">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">4K</span>
                  </div>
                  
                  {/* Enhanced gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />

                  {/* Play button with animation */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                      <Film className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>

                  {/* Movie badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-accent text-accent-foreground rounded-md flex items-center gap-1 shadow-md">
                    <Film className="h-3 w-3" />
                    Movie
                  </div>

                  {/* Token Crown Badge */}
                  <TokenCrownBadge />

                  {/* NEW badge */}
                  {isNew(movie.created_at) && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-md animate-pulse shadow-md">
                      NEW
                    </div>
                  )}

                  {/* Coming Soon badge for upcoming */}
                  {movie.status === 'upcoming' && (
                    <div className="absolute top-10 left-2 px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-md animate-pulse shadow-md flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      Coming Soon
                    </div>
                  )}

                  {/* Detailed info on hover - slides up from bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                    {/* Description */}
                    <p className="text-white/90 text-xs line-clamp-3 mb-2">
                      {movie.description || 'No description available'}
                    </p>
                    
                    {/* Meta info */}
                    <div className="flex items-center gap-2 text-white/80 text-xs">
                      {movie.release_year && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {movie.release_year}
                        </span>
                      )}
                      {movie.view_count && movie.view_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {movie.view_count} views
                        </span>
                      )}
                    </div>

                    {/* Genres */}
                    {movie.genres && movie.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {movie.genres.slice(0, 3).map(genre => (
                          <span 
                            key={genre}
                            className="px-2 py-0.5 text-xs bg-white/20 rounded-full text-white/90"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title only - simplified */}
                <h3 className="text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors duration-300">
                  {movie.title}
                </h3>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
}
