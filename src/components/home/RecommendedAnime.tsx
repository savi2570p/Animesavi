import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sparkles, Play, ChevronRight, CalendarClock, Wand2, Flame } from 'lucide-react';
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
    if (user) fetchRecommendations();
    else fetchPopular();
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

      let query = supabase
        .from('anime_public')
        .select('*')
        .overlaps('genres', genres)
        .order('view_count', { ascending: false })
        .limit(14);

      if (watchedIds.length > 0) {
        query = query.not('id', 'in', `(${watchedIds.join(',')})`);
      }

      const { data } = await query;
      if (data) {
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
    const { data } = await supabase
      .from('anime_public')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(14);
    if (data) {
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setRecommendations(shuffled);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <section className="py-12 relative">
        <div className="container">
          <div className="h-10 w-64 bg-muted/50 animate-pulse rounded-lg mb-6" />
          <div className="flex gap-3 overflow-hidden">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-[150px] md:w-[170px] shrink-0 aspect-[2/3] bg-muted/50 animate-pulse rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="py-12 relative overflow-hidden">
      {/* Layered backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-10 right-0 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="container relative">
        {/* Redesigned header */}
        <div className="flex items-end justify-between mb-7 gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-purple-500 shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)]">
                <Wand2 className="h-5 w-5 text-white" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                  {user ? (
                    <>Recommended <span className="anime-gradient-text">For You</span></>
                  ) : (
                    <>Popular <span className="anime-gradient-text">Right Now</span></>
                  )}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary border border-primary/30">
                  <Flame className="h-2.5 w-2.5" />
                  Picks
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {topGenres.length > 0
                  ? <>Tailored to your love for <span className="text-primary font-medium">{topGenres.join(' · ')}</span></>
                  : 'Hand-picked titles trending across the community'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="group shrink-0">
            <Link to="/browse" className="flex items-center gap-1">
              Explore all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {/* Genre chips */}
        {topGenres.length > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none -mx-4 px-4">
            {topGenres.map((g) => (
              <span
                key={g}
                className="shrink-0 px-3 py-1 text-[11px] font-medium rounded-full bg-card/60 text-foreground border border-border/60 backdrop-blur-sm"
              >
                #{g}
              </span>
            ))}
          </div>
        )}

        {/* Poster row */}
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {recommendations.map((anime, index) => (
            <AnimeCardContextMenu
              key={anime.id}
              animeTitle={anime.title || ''}
              animeUrl={`/anime/${anime.id}`}
              coverImage={anime.cover_image}
            >
              <Link
                to={`/anime/${anime.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[150px] md:w-[170px] lg:w-[190px] shrink-0`}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/40">
                  {/* Blurred background fill */}
                  {anime.cover_image && (
                    <img
                      src={anime.cover_image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ filter: 'blur(24px) brightness(0.4)' }}
                    />
                  )}
                  {/* Foreground poster */}
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title || ''}
                    className="relative z-[2] w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />

                  {/* Persistent legibility gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />

                  {/* Hover red wash */}
                  <div className="absolute inset-0 z-[3] bg-gradient-to-tr from-primary/35 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Top-left status */}
                  {anime.status === 'ongoing' && (
                    <span className="absolute top-2 left-2 z-[5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-primary/90 text-primary-foreground shadow">
                      On Air
                    </span>
                  )}
                  {anime.status === 'upcoming' && (
                    <span className="absolute top-2 left-2 z-[5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-orange-500/90 text-white shadow flex items-center gap-1 animate-pulse">
                      <CalendarClock className="h-2.5 w-2.5" />
                      Soon
                    </span>
                  )}

                  {/* Top-right 4K */}
                  <span className="absolute top-2 right-2 z-[5] text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                    4K
                  </span>

                  {/* Crown */}
                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  {/* Center play */}
                  <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-5 w-5 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 z-[5] p-2.5 pointer-events-none">
                    <h3 className="text-[13px] md:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-white/75">
                      {anime.release_year && <span>{anime.release_year}</span>}
                      {anime.release_year && anime.genres?.[0] && <span className="opacity-50">•</span>}
                      {anime.genres?.[0] && (
                        <span className="text-primary-foreground/90 font-medium truncate">
                          {anime.genres[0]}
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
}
