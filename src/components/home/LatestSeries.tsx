import { memo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tv, ChevronRight, Play, CalendarClock, Flame } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';

interface AnimeSeries {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
  episode_count: number;
  status: string | null;
  latest_episode_date: string | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
}

export const LatestSeries = memo(function LatestSeries() {
  const [series, setSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSeries();
  }, []);

  const fetchLatestSeries = async () => {
    try {
      // Drive the row from the newest EPISODES, not from `anime.updated_at`.
      // A series whose anime row was last edited months ago (e.g. Captain
      // Tsubasa) still belongs here the moment a new episode lands, and the
      // old `order by anime.updated_at limit 60` window silently dropped it.
      const { data: recentEpisodes, error: epError } = await supabase
        .from('episodes')
        .select('season_id, created_at')
        .order('created_at', { ascending: false })
        .limit(600);

      if (epError) throw epError;

      const seasonIds = Array.from(new Set((recentEpisodes || []).map(e => e.season_id)));
      if (seasonIds.length === 0) {
        setSeries([]);
        return;
      }

      const { data: seasonRows } = await supabase
        .from('seasons')
        .select('id, anime_id')
        .in('id', seasonIds);

      const animeBySeason = new Map<string, string>();
      (seasonRows || []).forEach(s => animeBySeason.set(s.id, s.anime_id));

      // Newest-first ordering preserved: first sighting = latest episode date.
      const latestByAnime = new Map<string, string>();
      (recentEpisodes || []).forEach(ep => {
        const animeId = animeBySeason.get(ep.season_id);
        if (!animeId || latestByAnime.has(animeId)) return;
        latestByAnime.set(animeId, ep.created_at);
      });

      const candidateIds = Array.from(latestByAnime.keys());
      if (candidateIds.length === 0) {
        setSeries([]);
        return;
      }

      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select(`id, title, cover_image, created_at, updated_at, type, status, is_eng_dub, is_sub_only`)
        .in('id', candidateIds)
        .eq('type', 'series');

      if (animeError) throw animeError;

      const picked = (animeData || [])
        .map(anime => ({
          ...anime,
          latest_episode_date: latestByAnime.get(anime.id) || null,
          episode_count: 0,
        }))
        .sort((a, b) => {
          const dateA = a.latest_episode_date || a.updated_at || a.created_at;
          const dateB = b.latest_episode_date || b.updated_at || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
        .slice(0, 12);

      // Exact episode counts for just the 12 cards we render.
      if (picked.length > 0) {
        const { data: countSeasons } = await supabase
          .from('seasons')
          .select('id, anime_id')
          .in('anime_id', picked.map(a => a.id));

        const seasonToAnime = new Map<string, string>();
        (countSeasons || []).forEach(s => seasonToAnime.set(s.id, s.anime_id));

        const allSeasonIds = Array.from(seasonToAnime.keys());
        if (allSeasonIds.length > 0) {
          const { data: countRows } = await supabase
            .from('episodes')
            .select('season_id')
            .in('season_id', allSeasonIds)
            .limit(5000);

          const counts = new Map<string, number>();
          (countRows || []).forEach(row => {
            const animeId = seasonToAnime.get(row.season_id);
            if (!animeId) return;
            counts.set(animeId, (counts.get(animeId) || 0) + 1);
          });
          picked.forEach(a => { a.episode_count = counts.get(a.id) || 0; });
        }
      }

      setSeries(picked as AnimeSeries[]);
    } catch (error) {
      console.error('Error fetching latest series:', error);
    } finally {
      setLoading(false);
    }
  };



  const isNew = (anime: AnimeSeries) => {
    const dateToCheck = anime.latest_episode_date || anime.updated_at || anime.created_at;
    const hours = (Date.now() - new Date(dateToCheck).getTime()) / (1000 * 60 * 60);
    return hours <= 24;
  };

  const statusPill = (anime: AnimeSeries) => {
    if (anime.status === 'upcoming') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-orange-500/90 text-white">
          <CalendarClock className="h-2.5 w-2.5" /> Soon
        </span>
      );
    }
    if (anime.status === 'completed') {
      return <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-emerald-500/90 text-white">Com</span>;
    }
    if (anime.status === 'ongoing') {
      return <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary/90 text-primary-foreground">On Air</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tv className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Series</h2>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="w-[160px] md:w-[180px] shrink-0 space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (series.length === 0) return null;

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Crimson obsidian backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative">
        {/* Editorial header */}
        <div className="flex items-end justify-between mb-7 gap-4">
          <div className="flex items-stretch gap-3.5 min-w-0">
            {/* Vertical crimson bar */}
            <div className="w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-transparent shadow-[0_0_12px_hsl(var(--primary))]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Tv className="h-3 w-3" />
                  Library
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  / {series.length} titles
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-[2rem] font-heading font-bold leading-tight tracking-tight">
                Latest <span className="anime-gradient-text">Series</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground/90 mt-1 hidden sm:block">
                Hand-picked drops, ongoing arcs and freshly added seasons.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="group shrink-0 rounded-full border border-white/5 hover:border-primary/30 hover:bg-primary/10">
            <Link to="/latest-series" className="flex items-center gap-1">
              See all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {/* Poster row */}
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {series.slice(0, 12).map((anime, index) => (
            <AnimeCardContextMenu
              key={anime.id}
              animeTitle={anime.title}
              animeUrl={`/anime/${anime.id}`}
              coverImage={anime.cover_image}
            >
              <Link
                to={`/anime/${anime.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[150px] md:w-[170px] lg:w-[190px] shrink-0`}
              >
                {/* Rank ribbon */}
                <span className="absolute -top-1 -left-1 z-20 h-6 w-6 rounded-md bg-black/80 backdrop-blur border border-primary/40 text-[10px] font-black text-primary flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* Poster */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.5)] group-hover:-translate-y-1.5 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/50">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"
                    loading="lazy"
                  />

                  {/* Bottom legibility gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />

                  {/* Hover crimson wash */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Top-right badges */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                    {isNew(anime) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary text-primary-foreground shadow-md animate-pulse">
                        <Flame className="h-2.5 w-2.5" />New
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                      4K
                    </span>
                    <DubBadge isEngDub={(anime as any).is_eng_dub} isSubOnly={(anime as any).is_sub_only} />
                  </div>

                  {/* Top-left status */}
                  <div className="absolute top-2 left-2 pointer-events-none ml-6">
                    {statusPill(anime)}
                  </div>

                  {/* Crown */}
                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  {/* Center play */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300 ring-2 ring-white/30">
                      <Play className="h-5 w-5 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  {/* Title block */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 pointer-events-none">
                    <h3 className="text-[13px] md:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                      <p className="text-[10px] font-medium text-white/85 uppercase tracking-wider">
                        {anime.episode_count} EP{anime.episode_count !== 1 ? 's' : ''}
                      </p>
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
