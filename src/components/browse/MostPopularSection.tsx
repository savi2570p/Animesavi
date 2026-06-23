import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Play, Eye, Crown, Flame } from 'lucide-react';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface PopularAnime {
  id: string;
  title: string;
  cover_image: string | null;
  view_count: number;
  genres: string[] | null;
}

// Curated view counts for specific anime
const VIEW_COUNT_MAP: Record<string, number> = {
  'Your Name': 9500000,
  'Your lie in April': 3400000,
  'The Angel Next Door Spoils me Rotten': 1200000,
  'The angel next door spoils me rotten': 1200000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  "BOFURI: I Don't Want to Get Hurt, so I'll Max Out My Defense.": 2300000,
  "A Gatherer's Adventure in Isekai": 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
};

const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  return `${(views / 1000).toFixed(0)}K`;
};

export function MostPopularSection() {
  const [animeList, setAnimeList] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPopularAnime();
  }, []);

  const fetchPopularAnime = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, view_count, genres')
        .order('view_count', { ascending: false })
        .limit(10);

      if (error) throw error;

      const animeWithViews = (data || []).map(anime => ({
        ...anime,
        view_count: VIEW_COUNT_MAP[anime.title] ||
          (anime.view_count && anime.view_count > 0 ? anime.view_count : Math.floor(Math.random() * (900000 - 100000) + 100000))
      }));

      animeWithViews.sort((a, b) => b.view_count - a.view_count);
      setAnimeList(animeWithViews);
    } catch (error) {
      console.error('Error fetching popular anime:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-10 p-6 bg-card/50 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold">Top 10 Most Popular</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (animeList.length === 0) return null;

  const totalViews = animeList.reduce((acc, a) => acc + a.view_count, 0);

  return (
    <div className="mb-10 relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-black/80 via-card/60 to-black/80 backdrop-blur-xl">
      {/* Ambient backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="relative p-5 md:p-7">
        {/* Editorial Header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-stretch gap-3.5 min-w-0">
            <div className="w-[3px] rounded-full bg-gradient-to-b from-amber-400 via-primary to-transparent shadow-[0_0_12px_hsl(var(--primary))]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                  <Crown className="h-3 w-3" />
                  Hall of Fame
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  / All Time
                </span>
              </div>
              <h2 className="text-2xl md:text-[1.875rem] font-heading font-bold leading-tight tracking-tight">
                Top 10 <span className="bg-gradient-to-r from-amber-300 via-primary to-amber-400 bg-clip-text text-transparent">Most Popular</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground/90 mt-1 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-primary" />
                {formatViews(totalViews)} combined views across the leaderboard.
              </p>
            </div>
          </div>
        </div>

        {/* Podium — top 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
          {animeList.slice(0, 3).map((anime, index) => {
            const rank = index + 1;
            const accent =
              rank === 1 ? 'from-amber-400 via-yellow-300 to-amber-500' :
              rank === 2 ? 'from-slate-200 via-slate-300 to-slate-400' :
                           'from-amber-600 via-orange-500 to-amber-700';
            const ringColor =
              rank === 1 ? 'group-hover:ring-amber-400/60' :
              rank === 2 ? 'group-hover:ring-slate-300/60' :
                           'group-hover:ring-amber-600/60';
            return (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                className="group relative block animate-fade-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className={`relative aspect-[16/10] sm:aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-xl ring-1 ring-white/5 ${ringColor} group-hover:-translate-y-1.5 group-hover:shadow-[0_25px_55px_-15px_hsl(var(--primary)/0.5)] transition-all duration-500`}>
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Giant rank numeral */}
                  <div className="absolute -bottom-4 -left-2 pointer-events-none select-none">
                    <span className={`text-[110px] leading-none font-black bg-gradient-to-b ${accent} bg-clip-text text-transparent opacity-90 drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]`}
                      style={{ WebkitTextStroke: '1.5px rgba(0,0,0,0.4)' }}>
                      {rank}
                    </span>
                  </div>

                  {/* Crown chip top-left */}
                  <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    <Crown className={`h-3 w-3 ${rank === 1 ? 'text-amber-300' : rank === 2 ? 'text-slate-200' : 'text-amber-500'}`} />
                    #{rank}
                  </div>

                  {/* View count */}
                  <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white/90">
                    <Eye className="h-3 w-3" />
                    {formatViews(anime.view_count)}
                  </div>

                  {/* Play hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-3 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300 ring-2 ring-white/30">
                      <Play className="h-5 w-5 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  <TokenCrownBadge />

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 pl-16">
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-black rounded mb-1.5 shadow">
                      H-DUB
                    </span>
                    <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 drop-shadow-lg">
                      {anime.title}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Remaining 4-10 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {animeList.slice(3).map((anime, idx) => {
            const rank = idx + 4;
            return (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                className="group relative block animate-fade-in"
                style={{ animationDelay: `${(idx + 3) * 50}ms` }}
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-md ring-1 ring-white/5 group-hover:ring-primary/40 group-hover:-translate-y-1 group-hover:shadow-[0_15px_35px_-10px_hsl(var(--primary)/0.45)] transition-all duration-500">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Rank numeral background */}
                  <div className="absolute -bottom-2 -left-1 pointer-events-none select-none">
                    <span className="text-[64px] leading-none font-black text-white/95 drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)]"
                      style={{ WebkitTextStroke: '1px hsl(var(--primary))' }}>
                      {rank}
                    </span>
                  </div>

                  {/* Views */}
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-semibold text-white/90 border border-white/10">
                    <Eye className="h-2.5 w-2.5" />
                    {formatViews(anime.view_count)}
                  </div>

                  {/* Hover play */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-2.5 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-4 w-4 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  <TokenCrownBadge />

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 pl-10">
                    <h3 className="text-xs font-semibold text-white line-clamp-2 drop-shadow-lg">
                      {anime.title}
                    </h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
