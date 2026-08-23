import { memo, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Flame, ChevronRight, Play, Eye, Filter, Crown, TrendingUp } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PopularAnime {
  id: string;
  title: string;
  cover_image: string | null;
  view_count: number | null;
  status: string | null;
  genres: string[] | null;
}

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller'
];

// Extra curated counts specific to this row, merged over the shared map.
const EXTRA_VIEW_COUNTS: Record<string, number> = {
  'Your Name': 9500000,
  'The Angel Next Door Spoils me Rotten': 3600000,
  "BOFURI: I Don't Want to Get Hurt, so I'll Max Out My Defense.": 2300000,
};

const resolveViews = (title: string, dbViews: number | null | undefined) => {
  const key = Object.keys(EXTRA_VIEW_COUNTS).find(k => k.toLowerCase() === (title || '').toLowerCase());
  if (key) return EXTRA_VIEW_COUNTS[key];
  return getViewCount(title, dbViews);
};

export const MostPopular = memo(function MostPopular() {
  const [animeList, setAnimeList] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => { fetchPopularAnime(); }, []);

  const filteredList = useMemo(() => {
    if (!selectedGenre) return animeList;
    return animeList.filter(a => a.genres?.some(g => g.toLowerCase() === selectedGenre.toLowerCase()));
  }, [selectedGenre, animeList]);

  const fetchPopularAnime = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, view_count, status, genres')
        .order('view_count', { ascending: false })
        .limit(12);
      if (error) throw error;
      const animeWithViews = (data || []).map(a => ({
        ...a,
        view_count: VIEW_COUNT_MAP[a.title] || Math.floor(Math.random() * (9000000 - 1000000) + 1000000)
      }));
      animeWithViews.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      setAnimeList(animeWithViews);
    } catch (e) {
      console.error('Error fetching popular anime:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="h-12 w-72 bg-muted/40 animate-pulse rounded-xl mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-[160px] md:w-[200px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (animeList.length === 0) return null;

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="container relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 via-primary to-rose-600 shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)]">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse ring-2 ring-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                  Most <span className="anime-gradient-text">Popular</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary border border-primary/30">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Top Charts
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                The titles everyone is talking about right now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 rounded-full">
                  <Filter className="h-4 w-4" />
                  {selectedGenre || 'All Genres'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto bg-popover z-50">
                <DropdownMenuItem onClick={() => setSelectedGenre(null)} className={!selectedGenre ? 'bg-primary/10' : ''}>
                  All Genres
                </DropdownMenuItem>
                {ALL_GENRES.map(g => (
                  <DropdownMenuItem key={g} onClick={() => setSelectedGenre(g)} className={selectedGenre === g ? 'bg-primary/10' : ''}>
                    {g}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="ghost" size="sm" className="group">
              <Link to="/browse?sort=popular" className="flex items-center gap-1">
                See all
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No anime found for "{selectedGenre}".</p>
            <Button variant="link" onClick={() => setSelectedGenre(null)} className="mt-2">Clear filter</Button>
          </div>
        ) : (
          <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
            {filteredList.slice(0, 10).map((anime, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;
              return (
                <AnimeCardContextMenu
                  key={anime.id}
                  animeTitle={anime.title}
                  animeUrl={`/anime/${anime.id}`}
                  coverImage={anime.cover_image}
                >
                  <Link
                    to={`/anime/${anime.id}`}
                    className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[170px] md:w-[210px] lg:w-[230px] shrink-0`}
                  >
                    {/* Giant rank numeral behind card */}
                    <span
                      aria-hidden
                      className={`absolute -left-3 -top-4 z-0 font-heading font-black leading-none select-none pointer-events-none ${
                        isTop3 ? 'text-primary/30' : 'text-foreground/10'
                      }`}
                      style={{
                        fontSize: 'clamp(70px, 9vw, 120px)',
                        WebkitTextStroke: isTop3 ? '2px hsl(var(--primary) / 0.5)' : '1.5px hsl(var(--foreground) / 0.18)',
                        color: 'transparent',
                      }}
                    >
                      {rank}
                    </span>

                    <div className="relative ml-6 md:ml-8 aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/40 z-[1]">
                      {/* Blurred fill */}
                      {anime.cover_image && (
                        <img
                          src={anime.cover_image}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          style={{ filter: 'blur(24px) brightness(0.4)' }}
                        />
                      )}
                      <img
                        src={anime.cover_image || '/placeholder.svg'}
                        alt={anime.title}
                        className="relative z-[2] w-full h-full object-contain transition-all duration-700 group-hover:scale-105 pointer-events-none"
                        loading="lazy"
                      />

                      {/* Legibility gradient */}
                      <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />

                      {/* Top crown badge for top 3 */}
                      {isTop3 && (
                        <div className={`absolute top-2 left-2 z-[5] flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg backdrop-blur-md ${
                          rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black' :
                          rank === 2 ? 'bg-gradient-to-r from-zinc-200 to-zinc-400 text-black' :
                          'bg-gradient-to-r from-amber-700 to-amber-900 text-white'
                        }`}>
                          <Crown className="h-3 w-3" />
                          #{rank}
                        </div>
                      )}

                      {/* 4K */}
                      <span className="absolute top-2 right-2 z-[5] text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                        4K
                      </span>

                      {/* Crown token */}
                      <div className="pointer-events-none">
                        <TokenCrownBadge />
                      </div>

                      {/* Center play */}
                      <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none">
                        <div className="p-3 rounded-full bg-primary/95 shadow-lg">
                          <Play className="h-5 w-5 text-primary-foreground fill-current" />
                        </div>
                      </div>

                      {/* Bottom info */}
                      <div className="absolute bottom-0 left-0 right-0 z-[5] p-3 pointer-events-none">
                        <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                          {anime.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          {anime.view_count && anime.view_count > 0 && (
                            <span className="text-[10px] text-white/80 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-sm">
                              <Eye className="h-3 w-3" />
                              {formatViews(anime.view_count)}
                            </span>
                          )}
                          <span className="badge-glass-hdub">H-DUB</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </AnimeCardContextMenu>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
});
