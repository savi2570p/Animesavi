import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, ChevronRight, Rocket, Bell, Sparkles } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { UpcomingCountdownDialog } from '@/components/home/UpcomingCountdownDialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface UpcomingSeasonInfo {
  season_number: number;
  release_date: string | null;
  title?: string | null;
}

interface UpcomingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  created_at: string;
  type: string | null;
  upcoming_seasons?: number[];
  season_details?: UpcomingSeasonInfo[];
}

const getCountdown = (target: string | null) => {
  if (!target) return null;
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export function ComingSoon() {
  const [animeList, setAnimeList] = useState<UpcomingAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<UpcomingAnime | null>(null);
  const [, setTick] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchUpcomingAnime();
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUpcomingAnime = async () => {
    try {
      const { data: animeData, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, release_year, created_at, type')
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) console.error('Error fetching upcoming anime:', error);

      const { data: upcomingSeasons } = await supabase
        .from('seasons')
        .select('season_number, release_date, title, created_at, anime:anime_id(id, title, cover_image, release_year, type)')
        .eq('is_upcoming', true as any)
        .order('release_date', { ascending: true, nullsFirst: false })
        .limit(16);

      const merged: UpcomingAnime[] = ((animeData as any[]) || []).map(a => ({ ...a, season_details: [] }));
      const byAnimeId = new Map<string, UpcomingAnime>();
      merged.forEach(a => byAnimeId.set(a.id, a));

      ((upcomingSeasons as any[]) || []).forEach((s) => {
        if (!s.anime) return;
        const detail: UpcomingSeasonInfo = { season_number: s.season_number, release_date: s.release_date || null, title: s.title };
        const existing = byAnimeId.get(s.anime.id);
        if (existing) {
          existing.upcoming_seasons = [...(existing.upcoming_seasons || []), s.season_number];
          existing.season_details = [...(existing.season_details || []), detail];
        } else {
          const entry: UpcomingAnime = {
            id: s.anime.id,
            title: s.anime.title,
            cover_image: s.anime.cover_image,
            release_year: s.anime.release_year,
            created_at: s.created_at,
            type: s.anime.type,
            upcoming_seasons: [s.season_number],
            season_details: [detail],
          };
          byAnimeId.set(s.anime.id, entry);
          merged.push(entry);
        }
      });

      setAnimeList(merged.slice(0, 8));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoading && animeList.length === 0) return null;

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 right-10 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-10 w-72 h-72 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="container relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600 shadow-[0_8px_30px_-8px_rgba(249,115,22,0.7)]">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-orange-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                  Coming <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">Soon</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/30">
                  <Bell className="h-2.5 w-2.5" />
                  Upcoming
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Get ready — these titles are dropping soon
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="group">
            <Link to="/upcoming" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-orange-500/20 scrollbar-track-transparent">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2 w-[170px] md:w-[200px] shrink-0">
                <Skeleton className="aspect-[2/3] rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : (
            animeList.map((anime) => {
              const nearestRelease = anime.season_details?.find(s => s.release_date)?.release_date || null;
              const countdown = getCountdown(nearestRelease);

              const card = (
                <div
                  onClick={() => setSelectedAnime(anime)}
                  className="group relative w-[170px] md:w-[200px] lg:w-[220px] shrink-0 cursor-pointer animate-fade-in"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-orange-500/50">
                    {/* Blurred backdrop */}
                    {anime.cover_image && (
                      <img
                        src={anime.cover_image}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        style={{ filter: 'blur(24px) brightness(0.35)' }}
                      />
                    )}
                    {anime.cover_image ? (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="relative z-[2] w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="relative z-[2] w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}

                    {/* Locked overlay */}
                    <div className="absolute inset-0 z-[3] bg-gradient-to-t from-black/85 via-black/40 to-black/30 group-hover:from-black/70 transition-all duration-300" />

                    {/* Top badges */}
                    <div className="absolute top-2 left-2 right-2 z-[5] flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                        <Rocket className="h-2.5 w-2.5" />
                        Soon
                      </span>
                      {anime.release_year && (
                        <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                          {anime.release_year}
                        </span>
                      )}
                    </div>

                    {/* Center countdown / coming soon */}
                    <div className="absolute inset-0 z-[4] flex items-center justify-center px-3 pointer-events-none">
                      <div className="text-center">
                        {countdown ? (
                          <div className="px-3 py-2 rounded-xl bg-black/55 backdrop-blur-md border border-orange-500/30 shadow-xl">
                            <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-orange-300 font-semibold mb-0.5">
                              <CalendarClock className="h-3 w-3" />
                              Releases in
                            </div>
                            <div className="text-base md:text-lg font-heading font-bold text-white leading-tight">
                              {countdown}
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-xl bg-black/55 backdrop-blur-md border border-white/10">
                            <CalendarClock className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                            <span className="text-white text-[11px] font-semibold uppercase tracking-wider">
                              Coming Soon
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom title */}
                    <div className="absolute bottom-0 left-0 right-0 z-[5] p-3 pointer-events-none">
                      <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                        {anime.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/70">
                        {anime.type && (
                          <span className="px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm uppercase font-bold">
                            {anime.type}
                          </span>
                        )}
                        {anime.upcoming_seasons && anime.upcoming_seasons.length > 0 && (
                          <span className="text-orange-300 font-medium">
                            S{Math.min(...anime.upcoming_seasons)} incoming
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover wash */}
                    <div className="absolute inset-0 z-[3] bg-gradient-to-tr from-orange-500/20 via-transparent to-amber-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                </div>
              );

              if (isMobile) return <div key={anime.id}>{card}</div>;

              return (
                <AnimeCardContextMenu
                  key={anime.id}
                  animeTitle={anime.title}
                  animeUrl={`/anime/${anime.id}`}
                  coverImage={anime.cover_image}
                >
                  {card}
                </AnimeCardContextMenu>
              );
            })
          )}
        </div>
      </div>

      <UpcomingCountdownDialog
        anime={selectedAnime}
        onClose={() => setSelectedAnime(null)}
      />
    </section>
  );
}
