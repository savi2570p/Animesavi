import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Play, Star, Sparkles, Flame, Languages, Mic } from 'lucide-react';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { PageLoader } from '@/components/layout/PageLoader';

interface EngDubAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  view_count: number | null;
  episode_count?: number;
  latest_episode_at?: string | null;
}

const ACCENT = 'from-sky-400 via-indigo-400 to-violet-500';

function formatViewCount(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return count.toString();
}

export default function EngDubPage() {
  const [animeList, setAnimeList] = useState<EngDubAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'series' | 'movie'>('all');

  useEffect(() => {
    const fetchEngDub = async () => {
      const { data, error } = await (supabase as any)
        .from('anime')
        .select('id, title, cover_image, type, status, view_count')
        .eq('is_eng_dub', true)
        .order('title');

      if (!error && data) {
        const enriched = await Promise.all(
          data.map(async (anime: any) => {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('id')
              .eq('anime_id', anime.id);
            const seasonIds = seasonData?.map((s) => s.id) || [];
            let episodeCount = 0;
            let latestEpAt: string | null = null;
            if (seasonIds.length > 0) {
              const { count } = await supabase
                .from('episodes')
                .select('id', { count: 'exact', head: true })
                .in('season_id', seasonIds);
              episodeCount = count || 0;
              const { data: latestEp } = await supabase
                .from('episodes')
                .select('created_at')
                .in('season_id', seasonIds)
                .order('created_at', { ascending: false })
                .limit(1);
              latestEpAt = latestEp?.[0]?.created_at || null;
            }
            return {
              ...anime,
              view_count:
                anime.view_count && anime.view_count >= 1000
                  ? anime.view_count
                  : Math.floor(Math.random() * (7_000_000 - 500_000) + 500_000),
              episode_count: episodeCount,
              latest_episode_at: latestEpAt,
            };
          })
        );

        enriched.sort((a, b) => {
          if (a.latest_episode_at && b.latest_episode_at) {
            return new Date(b.latest_episode_at).getTime() - new Date(a.latest_episode_at).getTime();
          }
          if (a.latest_episode_at) return -1;
          if (b.latest_episode_at) return 1;
          return a.title.localeCompare(b.title);
        });

        setAnimeList(enriched);
      }
      setIsLoading(false);
    };
    fetchEngDub();
  }, []);

  const filtered = animeList.filter((a) => {
    if (filter === 'series') return a.type !== 'movie';
    if (filter === 'movie') return a.type === 'movie';
    return true;
  });

  const totalEps = animeList.reduce((s, a) => s + (a.episode_count || 0), 0);
  const readyCount = animeList.filter((a) => (a.episode_count || 0) > 0).length;

  return (
    <div className="min-h-screen">
      {isLoading && <PageLoader label="Loading ENG DUB" accent="rose-500" done={!isLoading} />}
      <ContentNavTabs />

      {/* Header — dark aurora */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-sky-500/10 to-transparent" />
        <div className="absolute -top-24 left-1/3 w-[30rem] h-[30rem] bg-indigo-500/25 rounded-full blur-[130px]" />
        <div className="absolute top-10 right-10 w-[22rem] h-[22rem] bg-sky-400/20 rounded-full blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />

        <div className="container relative px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-8">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-indigo-500/40 blur-2xl rounded-full" />
              <div className={`relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-gradient-to-br ${ACCENT} shadow-2xl shadow-indigo-500/30`}>
                <Mic className="h-9 md:h-10 w-9 md:w-10 text-white drop-shadow-lg" strokeWidth={2.4} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 mb-3">
                <Languages className="h-3 w-3 text-sky-300" />
                <span className="text-[10px] font-bold text-sky-200 uppercase tracking-[0.2em]">English Dub Library</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tight leading-none">
                ENG<span className={`bg-gradient-to-r ${ACCENT} bg-clip-text text-transparent`}> DUB</span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
                Officially licensed anime dubbed in English — crystal-clear voice acting, cinematic quality.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Play className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-xs font-semibold">{readyCount} Titles</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">{totalEps} Episodes</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                  <span className="text-xs font-semibold">Premium 4K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 mt-7 overflow-x-auto scrollbar-none -mx-4 px-4">
            {([
              { key: 'all', label: 'All Titles' },
              { key: 'series', label: 'Series' },
              { key: 'movie', label: 'Movies' },
            ] as const).map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]'
                      : 'bg-card/60 text-muted-foreground border border-border/40 hover:bg-card hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container px-4 pb-12">
        <div className="flex items-center gap-3 mb-5">
          <div className={`h-6 w-1 rounded-full bg-gradient-to-b ${ACCENT}`} />
          <h2 className="text-lg md:text-xl font-heading font-black">
            {filter === 'all' ? 'Full ENG DUB Library' : filter === 'series' ? 'Dubbed Series' : 'Dubbed Movies'}
          </h2>
          <span className="text-xs text-muted-foreground">({filtered.length})</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border/50 bg-card/30">
            <Mic className="h-14 w-14 text-indigo-400/60 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No ENG DUB titles yet</h3>
            <p className="text-muted-foreground text-sm">Admins can flag anime as ENG DUB from the edit page — they'll show up here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((anime, index) => (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/30 group-hover:ring-indigo-400/60 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-indigo-500/25">
                  {anime.cover_image ? (
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${ACCENT} flex items-center justify-center shadow-2xl shadow-indigo-500/50 scale-90 group-hover:scale-100 transition-transform`}>
                      <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(anime.view_count || 0)}
                    </div>
                    {(anime.episode_count || 0) > 0 && (
                      <span className="text-[9px] font-bold text-white/80 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm">
                        {anime.episode_count} EP
                      </span>
                    )}
                  </div>

                  <TokenCrownBadge />
                  <div className={`absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black bg-gradient-to-r ${ACCENT} text-white rounded-md shadow-md uppercase tracking-wider`}>
                    ENG DUB
                  </div>
                </div>
                <div className="mt-2.5">
                  <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-sky-300 transition-colors">
                    {anime.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
