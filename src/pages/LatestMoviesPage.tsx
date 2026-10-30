import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Clock, Star, CalendarClock, Sparkles, Clapperboard } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';
import { DubBadge } from '@/components/anime/DubBadge';

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
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
  firstEpisodeId?: string | null;
}

export default function LatestMoviesPage() {
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
        .limit(50);

      if (error) throw error;
      
      const moviesWithEpisodes = await Promise.all(
        (data || []).map(async (movie) => {
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', movie.id)
            .order('season_number')
            .limit(1);
          
          if (seasons && seasons.length > 0) {
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

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  const newCount = movies.filter(m => isNew(m.created_at)).length;
  const upcomingCount = movies.filter(m => m.status === 'upcoming').length;

  return (
    <div className="min-h-screen catalogue-page-v5">
      <ContentNavTabs />

      <SeeAllHeader
        icon={Clapperboard}
        title="Latest Movies"
        subtitle="Cinematic anime films — recently added to the AnimeSavi library."
        eyebrow="Big Screen"
        iconGradient="from-amber-500 via-orange-500 to-rose-500"
        glowTone="bg-amber-500/20"
        stats={[
          { icon: Film, value: movies.length, label: 'Movies', tone: 'text-accent-foreground' },
          { icon: Sparkles, value: newCount, label: 'New 24h', tone: 'text-primary' },
          { icon: CalendarClock, value: upcomingCount, label: 'Upcoming', tone: 'text-accent-foreground' },
        ]}
      />

      <div className="container pb-12">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center py-16">
            <Film className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Movies Found</h3>
            <p className="text-muted-foreground">Check back later for new movies.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {movies.map((movie, index) => (
              <AnimeCardContextMenu
                key={movie.id}
                animeTitle={movie.title}
                animeUrl={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
                coverImage={movie.cover_image}
              >
                <Link
                  to={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
                  className="catalogue-tile-v5 group relative block"
                  style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-3 shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.03] group-hover:-translate-y-2">
                    <img
                      src={movie.cover_image || '/placeholder.svg'}
                      alt={movie.title}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                        <Film className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>

                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-accent text-accent-foreground rounded-md flex items-center gap-1 shadow-md">
                      <Film className="h-3 w-3" />
                      Movie
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {isNew(movie.created_at) && (
                        <div className="px-2 py-0.5 text-xs font-bold bg-secondary text-foreground rounded-md animate-pulse shadow-md">
                          NEW
                        </div>
                      )}
                      <DubBadge isEngDub={(movie as any).is_eng_dub} isSubOnly={(movie as any).is_sub_only} genres={(movie as any).genres} />

                    </div>

                    {movie.status === 'upcoming' && (
                      <div className="absolute top-10 left-2 px-2 py-1 text-xs font-bold bg-accent text-foreground rounded-md animate-pulse shadow-md flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Coming Soon
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
                      <p className="text-foreground/90 text-xs line-clamp-3 mb-2">
                        {movie.description || 'No description available'}
                      </p>
                      
                      <div className="flex items-center gap-2 text-foreground/80 text-xs">
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

                      {movie.genres && movie.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {movie.genres.slice(0, 3).map(genre => (
                            <span 
                              key={genre}
                              className="px-2 py-0.5 text-xs bg-foreground/20 rounded-full text-foreground/90"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm md:text-base font-semibold line-clamp-2 group-hover:text-primary transition-colors duration-300">
                    {movie.title}
                  </h3>
                </Link>
              </AnimeCardContextMenu>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
