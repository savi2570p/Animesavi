import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, ChevronRight, Clock, Check, User } from 'lucide-react';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

import { toast } from 'sonner';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

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
  watched_at: string;
  season?: Season;
  hasNewEpisode?: boolean;
}

interface ContinueWatchingProps {
  showOnHomeOnly?: boolean;
}

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

  useEffect(() => {
    if (user && shouldRender) {
      fetchRecentHistory();
      fetchUserProfile();
    } else {
      setIsLoading(false);
    }
  }, [user, shouldRender]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const fetchRecentHistory = async () => {
    setIsLoading(true);
    // Now we have ONE entry per anime per user (unique constraint enforced)
    // No need for client-side deduplication
    const { data } = await supabase
      .from('watch_history')
      .select('*, anime:anime_id(*), episode:episode_id(*)')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .order('watched_at', { ascending: false })
      .limit(12);

    if (data) {
      // Fetch season info + check for new episodes on ongoing anime
      const itemsWithSeason = await Promise.all(
        (data as WatchHistoryItem[]).map(async (item) => {
          let season: Season | undefined;
          if (item.episode?.season_id) {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('id, season_number')
              .eq('id', item.episode.season_id)
              .single();
            season = seasonData || undefined;
          }

          // Check if this ongoing anime has episodes newer than user's last watch
          let hasNewEpisode = false;
          if (item.anime?.status === 'ongoing') {
            const { data: newerEps } = await supabase
              .from('episodes')
              .select('id')
              .in('season_id', 
                (await supabase.from('seasons').select('id').eq('anime_id', item.anime.id)).data?.map(s => s.id) || []
              )
              .gt('created_at', item.watched_at)
              .limit(1);
            hasNewEpisode = !!newerEps && newerEps.length > 0;
          }

          return { ...item, season, hasNewEpisode };
        })
      );
      
      setHistory(itemsWithSeason);
    }
    setIsLoading(false);
  };

  const handleMarkCompleted = async (
    e: React.MouseEvent,
    historyId: string,
    animeTitle: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const item = history.find((h) => h.id === historyId);
    if (!item || !user) return;

    // 1. Start the pixel-fade animation on JUST this tile (scoped to the thumbnail).
    setFadingIds((prev) => new Set(prev).add(historyId));

    // Run the DB update + next-episode resolution in parallel with the 480ms fade animation.
    const minFadeMs = 480;
    const fadeDelay = new Promise<void>((r) => setTimeout(r, minFadeMs));

    // 2. Mark current episode as completed
    const { error: updateErr } = await supabase
      .from('watch_history')
      .update({ completed: true, progress: 100 })
      .eq('id', historyId);

    if (updateErr) {
      toast.error('Failed to mark as completed');
      setFadingIds((prev) => { const n = new Set(prev); n.delete(historyId); return n; });
      return;
    }

    // 2. Find next episode — same season first, then first ep of next season
    let nextEpisode: { id: string; episode_number: number; season_id: string } | null = null;
    let nextSeasonNumber: number | undefined = item.season?.season_number;

    const { data: sameSeasonNext } = await supabase
      .from('episodes')
      .select('id, episode_number, season_id')
      .eq('season_id', item.episode.season_id)
      .gt('episode_number', item.episode.episode_number)
      .order('episode_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (sameSeasonNext) {
      nextEpisode = sameSeasonNext;
    } else {
      const { data: nextSeason } = await supabase
        .from('seasons')
        .select('id, season_number')
        .eq('anime_id', item.anime.id)
        .gt('season_number', item.season?.season_number || 1)
        .order('season_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextSeason) {
        const { data: firstEp } = await supabase
          .from('episodes')
          .select('id, episode_number, season_id')
          .eq('season_id', nextSeason.id)
          .order('episode_number', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstEp) {
          nextEpisode = firstEp;
          nextSeasonNumber = nextSeason.season_number;
        }
      }
    }

    // 3. Upsert a fresh continue-watching row pointing to the next episode
    if (nextEpisode) {
      const { data: newRow, error: upsertErr } = await supabase
        .from('watch_history')
        .upsert(
          {
            user_id: user.id,
            anime_id: item.anime.id,
            episode_id: nextEpisode.id,
            progress: 0,
            completed: false,
            watched_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,anime_id' },
        )
        .select('*, anime:anime_id(*), episode:episode_id(*)')
        .single();

      if (!upsertErr && newRow) {
        // Wait for fade-out to finish, then swap content in place + fade back in.
        await fadeDelay;
        setHistory((prev) =>
          prev.map((h) =>
            h.id === historyId
              ? {
                  ...(newRow as WatchHistoryItem),
                  season: {
                    id: nextEpisode!.season_id,
                    season_number: nextSeasonNumber || 1,
                  },
                  hasNewEpisode: false,
                }
              : h,
          ),
        );
        // Clear fade so the new tile fades back in.
        setFadingIds((prev) => { const n = new Set(prev); n.delete(historyId); return n; });
        toast.success(
          nextSeasonNumber && nextSeasonNumber !== item.season?.season_number
            ? `${animeTitle} — starting Season ${nextSeasonNumber}`
            : `${animeTitle} — next episode ready`,
        );
        return;
      }
    }

    // 4. No next episode found (series finished) — let fade complete then remove.
    await fadeDelay;
    setHistory((prev) => prev.filter((h) => h.id !== historyId));
    setFadingIds((prev) => { const n = new Set(prev); n.delete(historyId); return n; });
    toast.success(`${animeTitle} marked as completed`);
  };

  const formatTimeLeft = (progress: number | null, duration: number | null) => {
    if (!progress || !duration) return null;
    const remaining = Math.max(0, duration - (duration * progress / 100));
    const minutes = Math.floor(remaining / 60);
    return `${minutes}m left`;
  };

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
            <Link to="/history" className="flex items-center gap-1">
              <span className="hidden sm:inline">View all</span>
              <span className="sm:hidden">All</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: false,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {history.map((item, index) => {
              const progressPct = Math.min(Math.max(item.progress || 0, 0), 100);
              const timeLeft = formatTimeLeft(item.progress, item.episode.duration);
              const isFading = fadingIds.has(item.id);
              return (
                <CarouselItem key={item.id} className="pl-2 md:pl-4 basis-[80%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <div className="group relative opacity-0 animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
                    {/* Single-tap link covers the entire card. All decorative overlays use pointer-events-none
                        so the first tap on mobile navigates immediately (no hover-then-tap double click). */}
                    <Link
                      to={`/watch/${item.episode.id}?t=${item.progress || 0}`}
                      className={`relative block aspect-video rounded-2xl overflow-hidden bg-muted/40 border border-border/40 group-hover:border-primary/50 transition-all duration-500 shadow-md hover:shadow-xl hover:shadow-primary/20 ${
                        isFading ? 'cw-tile-fading' : 'cw-tile-fresh'
                      }`}
                      aria-label={`Resume ${item.anime.title} episode ${item.episode.episode_number}`}
                    >
                      <img
                        src={item.episode.thumbnail || item.anime.cover_image || '/placeholder.svg'}
                        alt={item.anime.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                        loading="lazy"
                        draggable={false}
                      />

                      {/* Bottom gradient for legibility */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                      {/* Top badges row */}
                      <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-primary/95 text-[10px] font-bold text-primary-foreground shadow-sm">
                            S{item.season?.season_number || 1} · E{item.episode.episode_number}
                          </span>
                          {item.hasNewEpisode && (
                            <span className="badge-glass-new animate-pulse shadow-lg shadow-green-500/40">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-white tabular-nums">
                            {Math.round(progressPct)}%
                          </span>
                          <span className="badge-glass-hdub">H-DUB</span>
                        </div>
                      </div>

                      {/* Center play hint — desktop hover only, never blocks taps */}
                      <div className="pointer-events-none absolute inset-0 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl scale-150" />
                          <div className="relative w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50">
                            <Play className="h-5 w-5 text-primary-foreground fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Token Crown Badge (decorative) */}
                      <div className="pointer-events-none">
                        <TokenCrownBadge />
                      </div>

                      {/* Bottom info: title + meta inside the card for a more premium look */}
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 pb-4">
                        <h3 className="text-sm font-semibold text-white line-clamp-1 drop-shadow-md">
                          {item.anime.title}
                        </h3>
                        <p className="text-[11px] text-white/75 mt-0.5 flex items-center gap-1.5">
                          <span>EP {item.episode.episode_number}</span>
                          {timeLeft && (
                            <>
                              <span className="opacity-50">·</span>
                              <span className="text-primary-foreground/90">{timeLeft}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Premium progress bar pinned to the very bottom edge */}
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                        <div
                          className="relative h-full bg-gradient-to-r from-primary via-primary to-primary/80 transition-[width] duration-500 ease-out"
                          style={{ width: `${progressPct}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shine" />
                        </div>
                      </div>
                    </Link>

                    {/* "Done" action — sits ABOVE the link, never on the tap path of the thumbnail center.
                        Tiny pill in the top-right that only appears on hover (desktop) or always on mobile via active state. */}
                    <button
                      type="button"
                      onClick={(e) => handleMarkCompleted(e, item.id, item.anime.title)}
                      className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold bg-background/80 backdrop-blur-md border border-border/60 text-foreground/80 hover:text-primary hover:border-primary/60 hover:bg-background opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 shadow-md"
                      aria-label={`Mark ${item.anime.title} as completed`}
                      style={{ marginTop: '1.75rem' }}
                    >
                      <Check className="h-3 w-3" />
                      Done
                    </button>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
          <CarouselNext className="hidden md:flex -right-4 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50" />
        </Carousel>
      </div>
    </section>
  );
}
