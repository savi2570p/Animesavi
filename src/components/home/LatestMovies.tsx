import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Film, Clock, Star, ChevronRight } from 'lucide-react';

interface Movie {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  created_at: string;
  view_count: number | null;
}

export function LatestMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

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
      setMovies(data || []);
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
            <Link to="/browse?type=movie" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {movies.map((movie, index) => (
            <Link
              key={movie.id}
              to={`/anime/${movie.id}`}
              className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in`}
            >
              {/* Poster */}
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-3 shadow-lg">
                <img
                  src={movie.cover_image || '/placeholder.svg'}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Movie badge */}
                <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-accent text-accent-foreground rounded-md flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  Movie
                </div>

                {/* NEW badge for content uploaded in last 24 hours */}
                {isNew(movie.created_at) && (
                  <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-md animate-pulse">
                    NEW
                  </div>
                )}

                {/* Info on hover */}
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-xs line-clamp-2">
                    {movie.description}
                  </p>
                </div>
              </div>

              {/* Info */}
              <h3 className="text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors mb-1">
                {movie.title}
              </h3>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {movie.release_year && (
                  <>
                    <span>{movie.release_year}</span>
                    <span>•</span>
                  </>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(movie.created_at)}
                </div>
                {movie.view_count && movie.view_count > 0 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {movie.view_count} views
                    </div>
                  </>
                )}
              </div>

              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {movie.genres.slice(0, 2).map(genre => (
                    <span 
                      key={genre}
                      className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
