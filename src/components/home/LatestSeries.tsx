import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tv, ChevronRight, Play, CalendarClock, Sparkles } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface AnimeSeries {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
  episode_count: number;
  status: string | null;
  latest_episode_date: string | null;
}

export function LatestSeries() {
  const [series, setSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSeries();
  }, []);

  const fetchLatestSeries = async () => {
    try {
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select(`id, title, cover_image, created_at, updated_at, type, status`)
        .eq('type', 'series')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (animeError) throw animeError;

      const animeIds = (animeData || []).map(a => a.id);
      const { data: allSeasons } = await supabase
        .from('seasons')
        .select('id, anime_id')
        .in('anime_id', animeIds);

      const seasonsByAnime = new Map<string, string[]>();
      (allSeasons || []).forEach(season => {
        const existing = seasonsByAnime.get(season.anime_id) || [];
        existing.push(season.id);
        seasonsByAnime.set(season.anime_id, existing);
      });

      const allSeasonIds = (allSeasons || []).map(s => s.id);
      const allEpisodes: { id: string; season_id: string; created_at: string }[] = [];
      if (allSeasonIds.length > 0) {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: batch } = await supabase
            .from('episodes')
            .select('id, season_id, created_at')
            .in('season_id', allSeasonIds)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (batch) allEpisodes.push(...batch);
          hasMore = (batch?.length || 0) === pageSize;
          offset += pageSize;
        }
      }

      const episodesByAnime = new Map<string, { count: number; latestDate: string | null }>();
      allEpisodes.forEach(episode => {
        for (const [animeId, seasonIds] of seasonsByAnime.entries()) {
          if (seasonIds.includes(episode.season_id)) {
            const existing = episodesByAnime.get(animeId) || { count: 0, latestDate: null };
            existing.count++;
            if (!existing.latestDate || new Date(episode.created_at) > new Date(existing.latestDate)) {
              existing.latestDate = episode.created_at;
            }
            episodesByAnime.set(animeId, existing);
            break;
          }
        }
      });

      const seriesWithData: AnimeSeries[] = (animeData || [])
        .map((anime) => {
          const episodeData = episodesByAnime.get(anime.id) || { count: 0, latestDate: null };
          return { ...anime, episode_count: episodeData.count, latest_episode_date: episodeData.latestDate };
        })
        .filter(anime => anime.episode_count > 0);

      seriesWithData.sort((a, b) => {
        const dateA = a.latest_episode_date || a.updated_at || a.created_at;
        const dateB = b.latest_episode_date || b.updated_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setSeries(seriesWithData.slice(0, 12));
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
    <section className="py-10 md:py-14 relative">
      {/* Soft accent backdrop */}
      <div aria-hidden className="absolute inset-x-0 top-12 h-40 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="container relative">
        {/* Redesigned header */}
        <div className="flex items-end justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner">
                <Tv className="h-5 w-5 text-primary" />
              </div>
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                Latest <span className="anime-gradient-text">Series</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Sparkles className="h-3 w-3 text-primary" />
                Fresh drops & ongoing favorites
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="group shrink-0">
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
                {/* Poster */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/40">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"
                    loading="lazy"
                  />

                  {/* Bottom legibility gradient (always on) */}
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Top-right: NEW + 4K + H-DUB stack */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                    {isNew(anime) && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-primary text-primary-foreground shadow-md animate-pulse">
                        New
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                      4K
                    </span>
                    <span className="badge-glass-hdub">H-DUB</span>
                  </div>

                  {/* Top-left: status */}
                  <div className="absolute top-2 left-2 pointer-events-none">
                    {statusPill(anime)}
                  </div>

                  {/* Crown */}
                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  {/* Center play on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-5 w-5 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  {/* Title block over poster */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 pointer-events-none">
                    <h3 className="text-[13px] md:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {anime.title}
                    </h3>
                    <p className="text-[10px] font-medium text-white/80 mt-1.5">
                      {anime.episode_count} EP{anime.episode_count !== 1 ? 's' : ''}
                    </p>
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
