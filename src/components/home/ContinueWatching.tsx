import { memo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, ChevronRight, Clock, Check, User } from 'lucide-react';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { optimizedImageUrl, fhdFallback } from '@/lib/imageOptimization';

import { toast } from 'sonner';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { DubBadge } from '@/components/anime/DubBadge';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
}

interface Season {
  id: string;
  season_number: number;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  duration: number | null;
  season_id: string;
  thumbnail: string | null;
}

interface WatchHistoryItem {
  id: string;
  anime: Anime & { status?: string | null };
  episode: Episode;
  progress: number | null;
  completed?: boolean | null;
  completed_at?: string | null;
  last_position?: number | null;
  duration?: number | null;
  watched_at: string;
  season?: Season;
  hasNewEpisode?: boolean;
}

interface ContinueWatchingProps {
  showOnHomeOnly?: boolean;
}

const CONTINUE_WATCHING_CAROUSEL_OPTIONS = {
  align: 'start' as const,
  loop: false,
  dragFree: true,
  duration: 18,
  containScroll: 'trimSnaps' as const,
  skipSnaps: true,
};

function formatTimeLeft(progress: number | null, duration: number | null) {
  if (!progress || !duration) return null;
  const remaining = Math.max(0, duration - (duration * progress / 100));
  return `${Math.floor(remaining / 60)}m left`;
}

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  isFading: boolean;
  onMarkCompleted: (event: React.MouseEvent, historyId: string, animeTitle: string) => void;
}

const ContinueWatchingCard = memo(function ContinueWatchingCard({
  item,
  isFading,
  onMarkCompleted,
}: ContinueWatchingCardProps) {
  const progressPct = Math.min(Math.max(item.progress || 0, 0), 100);
  const timeLeft = formatTimeLeft(item.progress, item.episode.duration);
  const raw = item.episode.thumbnail || item.anime.cover_image || '/placeholder.svg';

  return (
    <CarouselItem className="cw-slide pl-2 md:pl-4 basis-[80%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
      <div className="group relative">
        <Link
          to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
          className={`relative block aspect-video rounded-2xl overflow-hidden bg-muted/40 border border-border/40 group-hover:border-primary/50 transition-all duration-500 shadow-md hover:shadow-xl hover:shadow-primary/20 ${
            isFading ? 'cw-tile-fading' : 'cw-tile-fresh'
          }`}
          aria-label={`Resume ${item.anime.title} episode ${item.episode.episode_number}`}
        >
          <img
            src={optimizedImageUrl(raw, { width: 960, quality: 78 })}
            onError={fhdFallback(raw)}
            alt={item.anime.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-primary/95 text-[10px] font-bold text-primary-foreground shadow-sm">
                S{item.season?.season_number || 1} · E{item.episode.episode_number}
              </span>
              {item.hasNewEpisode && <span className="badge-glass-new animate-pulse shadow-lg shadow-green-500/40">NEW</span>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-white tabular-nums">
                {Math.round(progressPct)}%
              </span>
              <DubBadge isEngDub={(item.anime as any).is_eng_dub} isSubOnly={(item.anime as any).is_sub_only} genres={(item.anime as any).genres} />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl scale-150" />
              <div className="relative w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50">
                <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
              </div>
            </div>
          </div>
          <div className="pointer-events-none"><TokenCrownBadge /></div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 pb-4">
            <h3 className="text-sm font-semibold text-white line-clamp-1 drop-shadow-md">{item.anime.title}</h3>
            <p className="text-[11px] text-white/75 mt-0.5 flex items-center gap-1.5">
              <span>EP {item.episode.episode_number}</span>
              {timeLeft && <><span className="opacity-50">·</span><span className="text-primary-foreground/90">{timeLeft}</span></>}
            </p>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-black/60">
            <div className="relative h-full bg-gradient-to-r from-primary via-primary to-primary/80 transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shine" />
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={(event) => onMarkCompleted(event, item.id, item.anime.title)}
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold bg-background/80 backdrop-blur-md border border-border/60 text-foreground/80 hover:text-primary hover:border-primary/60 hover:bg-background opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 shadow-md"
          aria-label={`Mark ${item.anime.title} as completed`}
          style={{ marginTop: '1.75rem' }}
        >
          <Check className="h-3 w-3" /> Done
        </button>
      </div>
    </CarouselItem>
  );
});

export function ContinueWatching({ showOnHomeOnly = false }: ContinueWatchingProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  // Tiles currently animating out (pixelate + fade) before being swapped to the next episode.
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  // Only show on home page if specified
  const isHomePage = typeof window !== 'undefined' && window.location.pathname === '/';
  const shouldRender = showOnHomeOnly ? isHomePage : true;

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setUserProfile(data);
  }, [user?.id]);

  const fetchRecentHistory = useCallback(async (showLoading = true) => {
    if (!user?.id) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);

    try {
      // 1. Resumable rows (in-progress) — keep the existing behaviour.
      const { data, error } = await supabase
        .from('watch_history')
        .select('id, progress, completed, completed_at, last_position, duration, watched_at, anime:anime_id(id,title,cover_image,status,is_eng_dub,is_sub_only,genres), episode:episode_id(id,title,episode_number,duration,season_id,thumbnail)')
        .eq('user_id', user.id)
        .or('completed.is.null,completed.eq.false')
        .order('watched_at', { ascending: false })
        .limit(60);

      if (error) {
        console.error('Error loading Continue Watching:', error);
        setHistory([]);
        return;
      }

      const dedupedByAnime = new Map<string, WatchHistoryItem>();
      ((data ?? []) as unknown as WatchHistoryItem[])
        .filter((item) => item.anime?.id && item.episode?.id)
        .forEach((item) => {
          if (!dedupedByAnime.has(item.anime.id)) dedupedByAnime.set(item.anime.id, item);
        });
      const rows = [...dedupedByAnime.values()].filter(
        (item) => item.anime?.id && item.episode?.id,
      ).slice(0, 12);
      const resumableAnimeIds = new Set(rows.map((r) => r.anime.id));

      // 2. Completed-series re-injection — Crunchyroll/Netflix behaviour:
      //    if the user finished every released episode of an anime and a NEW
      //    episode has dropped since their last watch, surface that anime in
      //    Continue Watching pointing directly at the newest episode.
      const { data: completedRows } = await supabase
        .from('watch_history')
        .select('anime_id, watched_at, episode:episode_id(season_id, episode_number)')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('watched_at', { ascending: false })
        .limit(80);

      const lastCompletedByAnime = new Map<string, { watched_at: string; season_id: string | null; episode_number: number }>();
      for (const row of (completedRows ?? []) as any[]) {
        if (!row.anime_id || resumableAnimeIds.has(row.anime_id)) continue;
        if (lastCompletedByAnime.has(row.anime_id)) continue;
        lastCompletedByAnime.set(row.anime_id, {
          watched_at: row.watched_at,
          season_id: row.episode?.season_id ?? null,
          episode_number: row.episode?.episode_number ?? 0,
        });
      }

      const newerEpisodeRows: WatchHistoryItem[] = [];
      if (lastCompletedByAnime.size > 0) {
        const completedAnimeIds = [...lastCompletedByAnime.keys()];
        const { data: animeSeasons } = await supabase
          .from('seasons')
          .select('id, anime_id, season_number')
          .in('anime_id', completedAnimeIds);
        const seasonsByAnime = new Map<string, { id: string; season_number: number }[]>();
        (animeSeasons ?? []).forEach((s: any) => {
          const arr = seasonsByAnime.get(s.anime_id) ?? [];
          arr.push({ id: s.id, season_number: s.season_number });
          seasonsByAnime.set(s.anime_id, arr);
        });

        const allSeasonIds = (animeSeasons ?? []).map((s: any) => s.id);
        if (allSeasonIds.length > 0) {
          const { data: laterEpisodes } = await supabase
            .from('episodes')
            .select('id, title, episode_number, duration, season_id, thumbnail, created_at')
            .in('season_id', allSeasonIds)
            .order('created_at', { ascending: false });

          // Pick the single newest episode per anime that is strictly newer than
          // the user's last-completed timestamp.
          const newestPerAnime = new Map<string, any>();
          const seasonToAnime = new Map<string, string>();
          (animeSeasons ?? []).forEach((s: any) => seasonToAnime.set(s.id, s.anime_id));

          for (const ep of (laterEpisodes ?? []) as any[]) {
            const animeId = seasonToAnime.get(ep.season_id);
            if (!animeId) continue;
            const last = lastCompletedByAnime.get(animeId);
            if (!last) continue;
            if (new Date(ep.created_at).getTime() <= new Date(last.watched_at).getTime()) continue;
            if (newestPerAnime.has(animeId)) continue;
            newestPerAnime.set(animeId, ep);
          }

          const animeMeta = await supabase
            .from('anime')
            .select('id, title, cover_image, status, is_eng_dub, is_sub_only')
            .in('id', [...newestPerAnime.keys()]);
          const animeMap = new Map((animeMeta.data ?? []).map((a: any) => [a.id, a]));

          newestPerAnime.forEach((ep, animeId) => {
            const animeInfo = animeMap.get(animeId);
            if (!animeInfo) return;
            newerEpisodeRows.push({
              id: `new-${animeId}-${ep.id}`,
              anime: animeInfo as any,
              episode: {
                id: ep.id,
                title: ep.title,
                episode_number: ep.episode_number,
                duration: ep.duration,
                season_id: ep.season_id,
                thumbnail: ep.thumbnail,
              },
              progress: 0,
              watched_at: ep.created_at,
              hasNewEpisode: true,
            });
          });
        }
      }

      const allRows = [...rows, ...newerEpisodeRows];

      const seasonIds = [...new Set(allRows.map((item) => item.episode.season_id).filter(Boolean))] as string[];
      const { data: seasonRows } = seasonIds.length
        ? await supabase.from('seasons').select('id, season_number').in('id', seasonIds)
        : { data: [] as Season[] };
      const seasonMap = new Map((seasonRows ?? []).map((season) => [season.id, season as Season]));

      const ongoingAnimeIds = [...new Set(
        rows.filter((item) => item.anime.status === 'ongoing').map((item) => item.anime.id),
      )];
      const { data: ongoingSeasonRows } = ongoingAnimeIds.length
        ? await supabase.from('seasons').select('id, anime_id').in('anime_id', ongoingAnimeIds)
        : { data: [] as { id: string; anime_id: string }[] };

      const newEpisodeAnimeIds = new Set<string>();
      if (ongoingSeasonRows?.length && rows.length) {
        const watchedByAnime = new Map(rows.map((item) => [item.anime.id, item.watched_at]));
        const seasonToAnime = new Map(ongoingSeasonRows.map((season) => [season.id, season.anime_id]));
        const oldestWatchedAt = rows[rows.length - 1]?.watched_at;

        const { data: newerEpisodes } = await supabase
          .from('episodes')
          .select('season_id, created_at')
          .in('season_id', ongoingSeasonRows.map((season) => season.id))
          .gt('created_at', oldestWatchedAt);

        (newerEpisodes ?? []).forEach((episode) => {
          const animeId = seasonToAnime.get(episode.season_id);
          const watchedAt = animeId ? watchedByAnime.get(animeId) : null;
          if (animeId && watchedAt && new Date(episode.created_at).getTime() > new Date(watchedAt).getTime()) {
            newEpisodeAnimeIds.add(animeId);
          }
        });
      }

      setHistory(allRows.map((item) => ({
        ...item,
        season: seasonMap.get(item.episode.season_id),
        hasNewEpisode: item.hasNewEpisode || newEpisodeAnimeIds.has(item.anime.id),
      })));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !shouldRender) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    void fetchRecentHistory(true);
    void fetchUserProfile();

    const refreshLatest = () => {
      if (document.visibilityState !== 'hidden') void fetchRecentHistory(false);
    };

    window.addEventListener('focus', refreshLatest);
    document.addEventListener('visibilitychange', refreshLatest);

    // Realtime: refresh the row instantly when watch_history changes for this
    // user, OR when ANY new episode is uploaded (could affect a completed
    // series the user finished).
    const channel = supabase
      .channel(`continue-watching-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_history', filter: `user_id=eq.${user.id}` },
        () => { void fetchRecentHistory(false); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'episodes' },
        () => { void fetchRecentHistory(false); },
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', refreshLatest);
      document.removeEventListener('visibilitychange', refreshLatest);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, shouldRender, fetchRecentHistory, fetchUserProfile]);

  const handleMarkCompleted = useCallback(async (
    e: React.MouseEvent,
    historyId: string,
    animeTitle: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const item = history.find((h) => h.id === historyId);
    if (!item || !user) return;

    const durationSeconds = Math.max(0, Number(item.duration ?? item.episode.duration ?? 0));
    const previousProgress = Math.min(Math.max(item.progress || 0, 0), 100);
    const retry = async <T,>(operation: () => Promise<T>, attempts = 2): Promise<T> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
          console.error(`Continue Watching Done retry ${attempt}/${attempts} failed:`, error);
          if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
      throw lastError;
    };

    console.log('[ContinueWatching:Done] before update', {
      episodeId: item.episode.id,
      animeId: item.anime.id,
      userId: user.id,
      progressBefore: previousProgress,
      duration: durationSeconds,
      historyId,
    });

    // 1. Start the pixel-fade animation on JUST this tile (scoped to the thumbnail).
    setFadingIds((prev) => new Set(prev).add(historyId));

    // Run the DB update + next-episode resolution in parallel with the 480ms fade animation.
    const minFadeMs = 480;
    const fadeDelay = new Promise<void>((r) => setTimeout(r, minFadeMs));

    let rpcRow: {
      completed_history_id: string;
      next_history_id: string | null;
      next_episode_id: string | null;
      next_season_id: string | null;
      next_episode_number: number | null;
      next_season_number: number | null;
      action: 'next_episode' | 'completed_series';
    } | null = null;

    try {
      const doneResult = await retry<any>(async () => {
        const result = await (supabase as any).rpc('mark_continue_watching_done', {
          _anime_id: item.anime.id,
          _episode_id: item.episode.id,
          _duration: durationSeconds,
          _last_position: durationSeconds,
        });
        if (result.error) throw result.error;
        return result;
      });
      const { data: doneRows, error: doneErr } = doneResult;

      console.log('[ContinueWatching:Done] database response', { data: doneRows, error: doneErr });

      if (doneErr) throw doneErr;
      rpcRow = Array.isArray(doneRows) ? doneRows[0] : doneRows;
    } catch (error) {
      console.error('Mark completed failed:', {
        episodeId: item.episode.id,
        animeId: item.anime.id,
        userId: user.id,
        progressBefore: previousProgress,
        error,
      });
      toast.error('Failed to mark as completed');
      setFadingIds((prev) => { const n = new Set(prev); n.delete(historyId); return n; });
      return;
    }

    console.log('[ContinueWatching:Done] after update', {
      episodeId: item.episode.id,
      animeId: item.anime.id,
      userId: user.id,
      progressAfter: 100,
      completedHistoryId: rpcRow?.completed_history_id,
      nextEpisodeId: rpcRow?.next_episode_id,
      action: rpcRow?.action,
    });

    // The RPC auto-creates a "next episode" watch_history row so the series
    // stays in Continue Watching pointing at the NEXT episode. We keep that row
    // and just refetch — the tile smoothly transitions from the completed
    // episode to the next one. If this was the final episode, the RPC returns
    // action === 'completed_series' and no next row exists, so the tile is
    // removed and the series is treated as fully finished.
    await fadeDelay;
    setFadingIds((prev) => { const n = new Set(prev); n.delete(historyId); return n; });

    if (rpcRow?.action === 'completed_series') {
      setHistory((prev) => prev.filter((h) => h.id !== historyId));
      toast.success(`${animeTitle} — series completed`);
    } else {
      // Remove the completed tile immediately; realtime + refetch will surface
      // the freshly-created next-episode tile.
      setHistory((prev) => prev.filter((h) => h.id !== historyId));
      void fetchRecentHistory(false);
      toast.success(`Episode marked as watched · Next episode ready`);
    }
  }, [fetchRecentHistory, history, user]);

  if (!user || !shouldRender || (!isLoading && history.length === 0)) return null;

  if (isLoading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-8 w-8 bg-primary/20 rounded-lg animate-pulse" />
            <div className="h-8 w-56 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-video bg-muted animate-pulse rounded-xl skeleton-shimmer" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-x-hidden overflow-y-visible py-10 md:py-14">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />

      <div className="container relative">
        {/* Header — cleaner two-row layout on mobile */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-primary/40 shadow-lg shadow-primary/10 shrink-0">
              <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.username || 'User'} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {userProfile?.username?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <h2 className="text-xl md:text-2xl font-heading font-bold text-foreground truncate">
                  Continue Watching
                </h2>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                {userProfile?.username ? `Welcome back, ${userProfile.username}` : 'Pick up where you left off'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
          >
            <Link to="/continue-watching" className="flex items-center gap-1">
              <span className="hidden sm:inline">View all</span>
              <span className="sm:hidden">All</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Carousel
          opts={CONTINUE_WATCHING_CAROUSEL_OPTIONS}
          className="w-full cw-carousel"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {history.map((item) => (
              <ContinueWatchingCard
                key={item.id}
                item={item}
                isFading={fadingIds.has(item.id)}
                onMarkCompleted={handleMarkCompleted}
              />
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
          <CarouselNext className="hidden md:flex -right-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
        </Carousel>
      </div>
    </section>
  );
}
