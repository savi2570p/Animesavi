import { memo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Film, Clapperboard, Play, ChevronRight, CalendarClock, Star } from 'lucide-react';
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

export const LatestMovies = memo(function LatestMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLatestMovies(); }, []);

  const fetchLatestMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .eq('type', 'movie')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      const moviesWithEpisodes = await Promise.all(
        (data || []).map(async (movie) => {
          const { data: seasons } = await supabase
            .from('seasons').select('id').eq('anime_id', movie.id).order('season_number').limit(1);
          if (seasons && seasons.length > 0) {
            const { data: episodes } = await supabase
              .from('episodes').select('id').eq('season_id', seasons[0].id).order('episode_number').limit(1);
            return { ...movie, firstEpisodeId: episodes?.[0]?.id || null };
          }
          return { ...movie, firstEpisodeId: null };
        })
      );
      setMovies(moviesWithEpisodes);
    } catch (e) {
      console.error('Error fetching latest movies:', e);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (dateString: string) => {
    const hours = (Date.now() - new Date(dateString).getTime()) / 3_600_000;
    return hours <= 24;
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14 bg-card/30">
        <div className="container">
          <div className="h-12 w-72 bg-muted/40 animate-pulse rounded-xl mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-[160px] md:w-[200px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (movies.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-card/30 relative overflow-hidden">
      {/* Backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-accent via-accent/80 to-primary shadow-[0_8px_30px_-8px_hsl(var(--accent)/0.7)]">
                <Clapperboard className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent animate-pulse ring-2 ring-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                  Latest <span className="anime-gradient-text">Movies</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-accent/15 text-accent border border-accent/30">
                  <Film className="h-2.5 w-2.5" />
                  Cinema
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Big-screen anime films, ready to stream in 4K
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link to="/latest-movies" className="flex items-center gap-1">
              See all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {movies.slice(0, 8).map((movie, index) => (
            <AnimeCardContextMenu
              key={movie.id}
              animeTitle={movie.title}
              animeUrl={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
              coverImage={movie.cover_image}
            >
              <Link
                to={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in gpu-accelerate w-[160px] md:w-[200px] lg:w-[220px] shrink-0`}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-accent/50">
                  {/* Blurred fill */}
                  {movie.cover_image && (
                    <img
                      src={movie.cover_image}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ filter: 'blur(24px) brightness(0.4)' }}
                    />
                  )}
                  <img
                    src={movie.cover_image || '/placeholder.svg'}
                    alt={movie.title}
                    className="relative z-[2] w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />

                  {/* Cinematic letterbox bars on hover */}
                  <div className="absolute inset-x-0 top-0 h-2 z-[6] bg-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-2 z-[6] bg-black opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  {/* Legibility gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />

                  {/* Hover wash */}
                  <div className="absolute inset-0 z-[3] bg-gradient-to-tr from-accent/25 via-transparent to-primary/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Top-left Movie badge */}
                  <span className="absolute top-2 left-2 z-[5] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/95 text-accent-foreground text-[10px] font-bold uppercase tracking-wider shadow-md">
                    <Film className="h-2.5 w-2.5" />
                    Movie
                  </span>

                  {/* Top-right NEW + 4K + H-DUB stack */}
                  <div className="absolute top-2 right-2 z-[5] flex flex-col gap-1 items-end">
                    {isNew(movie.created_at) && (
                      <span className="badge-glass-new animate-pulse">NEW</span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                      4K
                    </span>
                    <span className="badge-glass-hdub">H-DUB</span>
                  </div>

                  {movie.status === 'upcoming' && (
                    <div className="absolute top-10 left-2 z-[5] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/95 text-white text-[10px] font-bold uppercase tracking-wider animate-pulse shadow">
                      <CalendarClock className="h-2.5 w-2.5" />
                      Soon
                    </div>
                  )}

                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  {/* Center play */}
                  <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-accent/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-5 w-5 text-accent-foreground fill-current" />
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 z-[5] p-3 pointer-events-none">
                    <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/80">
                      {movie.release_year && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm font-semibold">
                          {movie.release_year}
                        </span>
                      )}
                      {movie.genres?.[0] && (
                        <span className="flex items-center gap-1 text-white/75 truncate">
                          <Star className="h-2.5 w-2.5 text-accent" />
                          {movie.genres[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
});
