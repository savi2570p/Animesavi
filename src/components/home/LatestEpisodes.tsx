import { memo, useState, useEffect, useMemo } from 'react';
import { preloadFirstN } from '@/lib/imageOptimization';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, ChevronRight, Zap, Clock } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface LatestEpisode {
  id: string;
  title: string;
  episode_number: number;
  thumbnail: string | null;
  created_at: string;
  duration: number | null;
  season: {
    season_number: number;
    anime: {
      id: string;
      title: string;
      cover_image: string | null;
      type: string | null;
      status: string | null;
      is_eng_dub?: boolean | null;
    };
  };
}

interface GroupedEpisode {
  animeId: string;
  animeTitle: string;
  seasonNumber: number;
  coverImage: string | null;
  thumbnail: string | null;
  episodeMin: number;
  episodeMax: number;
  episodeCount: number;
  latestEpisodeId: string;
  latestCreatedAt: string;
  status: string | null;
  isEngDub?: boolean | null;
}

export const LatestEpisodes = memo(function LatestEpisodes() {
  const [episodes, setEpisodes] = useState<LatestEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestEpisodes();
  }, []);

  const fetchLatestEpisodes = async () => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select(`
          id, title, episode_number, thumbnail, created_at, duration,
          season:season_id (
            season_number,
            anime:anime_id ( id, title, cover_image, type, status, updated_at, is_eng_dub )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const filteredEpisodes = (data || []).filter((ep: any) =>
        ep.season?.anime && ep.season.anime.type !== 'movie'
      );

      setEpisodes(filteredEpisodes as unknown as LatestEpisode[]);
      preloadFirstN(
        filteredEpisodes.slice(0, 6).map((ep: any) => ({ thumbnail: ep.thumbnail || ep.season?.anime?.cover_image })),
        6
      );
    } catch (error) {
      console.error('Error fetching latest episodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedEpisodes = useMemo<GroupedEpisode[]>(() => {
    const groups = new Map<string, GroupedEpisode>();
    for (const ep of episodes) {
      if (!ep.season?.anime) continue;
      const key = `${ep.season.anime.id}-${ep.season.season_number}`;
      const existing = groups.get(key);
      if (existing) {
        existing.episodeMin = Math.min(existing.episodeMin, ep.episode_number);
        existing.episodeMax = Math.max(existing.episodeMax, ep.episode_number);
        existing.episodeCount++;
        if (new Date(ep.created_at) > new Date(existing.latestCreatedAt)) {
          existing.latestEpisodeId = ep.id;
          existing.latestCreatedAt = ep.created_at;
          existing.thumbnail = ep.thumbnail || existing.thumbnail;
        }
      } else {
        groups.set(key, {
          animeId: ep.season.anime.id,
          animeTitle: ep.season.anime.title,
          seasonNumber: ep.season.season_number,
          coverImage: ep.season.anime.cover_image,
          thumbnail: ep.thumbnail,
          episodeMin: ep.episode_number,
          episodeMax: ep.episode_number,
          episodeCount: 1,
          latestEpisodeId: ep.id,
          latestCreatedAt: ep.created_at,
          status: ep.season.anime.status,
          isEngDub: (ep.season.anime as any).is_eng_dub ?? false,
        });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime())
      .slice(0, 8);
  }, [episodes]);

  const isNew = (dateString: string) => {
    const hours = (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60);
    return hours <= 24;
  };

  const timeAgo = (dateString: string) => {
    const minutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  };

  const formatEpisodeRange = (min: number, max: number) =>
    min === max ? `Episode ${min}` : `Episodes ${min}–${max}`;

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Episodes</h2>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="w-[260px] shrink-0 space-y-2">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (groupedEpisodes.length === 0) return null;

  const hasFreshDrop = groupedEpisodes.some(g => isNew(g.latestCreatedAt));

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Crimson obsidian backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="container relative">
        {/* Editorial header */}
        <div className="flex items-end justify-between mb-7 gap-4">
          <div className="flex items-stretch gap-3.5 min-w-0">
            <div className="w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-transparent shadow-[0_0_12px_hsl(var(--primary))]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Zap className="h-3 w-3" />
                  Just In
                </span>
                {hasFreshDrop && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-[2rem] font-heading font-bold leading-tight tracking-tight">
                Latest <span className="anime-gradient-text">Episodes</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground/90 mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Freshly uploaded — straight from the encoder.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="group shrink-0 rounded-full border border-white/5 hover:border-primary/30 hover:bg-primary/10">
            <Link to="/latest-episodes" className="flex items-center gap-1">
              See all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {/* Episode row */}
        <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {groupedEpisodes.map((group, index) => {
            const displayImage = group.thumbnail || group.coverImage || '/placeholder.svg';
            const episodeRangeText = formatEpisodeRange(group.episodeMin, group.episodeMax);
            const hasMultipleEpisodes = group.episodeMin !== group.episodeMax;
            const fresh = isNew(group.latestCreatedAt);

            return (
              <AnimeCardContextMenu
                key={`${group.animeId}-${group.seasonNumber}`}
                animeTitle={group.animeTitle}
                animeUrl={`/watch/${group.latestEpisodeId}`}
                coverImage={displayImage}
              >
                <Link
                  to={`/watch/${group.latestEpisodeId}`}
                  className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[210px] md:w-[270px] lg:w-[310px] shrink-0`}
                >
                  {/* Thumbnail card */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-[0_25px_60px_-15px_hsl(var(--primary)/0.55)] group-hover:-translate-y-1.5 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/50">
                    <img
                      src={displayImage}
                      alt={group.animeTitle}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 pointer-events-none"
                      loading="lazy"
                    />

                    {/* Persistent legibility gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent pointer-events-none" />

                    {/* Hover crimson wash */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Top-left chips */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-black/70 backdrop-blur-md text-white border border-white/10">
                        S{group.seasonNumber}
                      </span>
                      {hasMultipleEpisodes && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-primary/90 text-primary-foreground shadow">
                          +{group.episodeCount}
                        </span>
                      )}
                    </div>

                    {/* Top-right badges */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end pointer-events-none">
                      {fresh && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-primary text-primary-foreground shadow-lg animate-pulse">
                          New
                        </span>
                      )}
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                        4K
                      </span>
                      {group.isEngDub ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow">
                          E-DUB
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/90 text-black shadow">
                          H-DUB
                        </span>
                      )}
                    </div>

                    {/* Crown */}
                    <div className="pointer-events-none">
                      <TokenCrownBadge />
                    </div>

                    {/* Center hover play */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                      <div className="p-4 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300 ring-2 ring-white/30">
                        <Play className="h-6 w-6 text-primary-foreground fill-current" />
                      </div>
                    </div>

                    {/* Time-ago pill */}
                    <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-semibold text-white/90 border border-white/10">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(group.latestCreatedAt)}
                      </span>
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 pr-24 pointer-events-none">
                      <h3 className="text-sm md:text-base font-semibold text-white line-clamp-1 drop-shadow-lg">
                        {group.animeTitle}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                        <p className="text-xs text-white/85 font-medium">{episodeRangeText}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </AnimeCardContextMenu>
            );
          })}
        </div>
      </div>
    </section>
  );
});
