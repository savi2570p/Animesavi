import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, Rocket, Clock, Layers } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { AnimatedPage } from '@/components/layout/AnimatedPage';
import { UpcomingCountdownDialog } from '@/components/home/UpcomingCountdownDialog';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';

interface UpcomingSeasonInfo {
  season_number: number;
  release_date: string | null;
  title?: string | null;
}

interface UpcomingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image?: string | null;
  release_year: number | null;
  created_at: string;
  type: string | null;
  status?: string | null;
  description?: string | null;
  genres?: string[] | null;
  studio?: string | null;
  total_episodes?: number | null;
  source_material?: string | null;
  content_rating?: string | null;
  upcoming_seasons?: number[];
  season_details?: UpcomingSeasonInfo[];
}

export default function UpcomingPage() {
  const [animeList, setAnimeList] = useState<UpcomingAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<UpcomingAnime | null>(null);

  useEffect(() => {
    fetchUpcoming();

    // Refetch when tab regains focus / page becomes visible so newly edited
    // metadata (total episodes, studio, source) appears immediately.
    const onFocus = () => fetchUpcoming();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUpcoming();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const fetchUpcoming = async () => {
    try {
      // Fetch anime explicitly marked as upcoming
      const { data: upcomingAnime } = await supabase
        .from('anime')
        .select('id, title, cover_image, banner_image, release_year, created_at, type, status, description, genres, studio, total_episodes, source_material, content_rating')
        .eq('status', 'upcoming')
        .order('release_year', { ascending: true })
        .order('created_at', { ascending: false });

      // Fetch seasons marked as upcoming, with parent anime info + release_date
      const { data: upcomingSeasons } = await supabase
        .from('seasons')
        .select('id, season_number, release_date, title, anime_id, created_at, anime:anime_id(id, title, cover_image, banner_image, release_year, type, status, description, genres, studio, total_episodes, source_material, content_rating)')
        .eq('is_upcoming', true as any)
        .order('release_date', { ascending: true, nullsFirst: false });

      // Group by anime id so multiple upcoming seasons of same anime become one card
      const byAnimeId = new Map<string, UpcomingAnime>();

      (upcomingAnime || []).forEach((a: any) => {
        byAnimeId.set(a.id, { ...a, upcoming_seasons: [], season_details: [] });
      });

      (upcomingSeasons || []).forEach((s: any) => {
        if (!s.anime) return;
        const detail: UpcomingSeasonInfo = { season_number: s.season_number, release_date: s.release_date || null, title: s.title };
        const existing = byAnimeId.get(s.anime.id);
        if (existing) {
          existing.upcoming_seasons = [...(existing.upcoming_seasons || []), s.season_number];
          existing.season_details = [...(existing.season_details || []), detail];
        } else {
          byAnimeId.set(s.anime.id, {
            id: s.anime.id,
            title: s.anime.title,
            cover_image: s.anime.cover_image,
            banner_image: s.anime.banner_image,
            release_year: s.anime.release_year,
            created_at: s.created_at,
            type: s.anime.type,
            status: s.anime.status,
            description: s.anime.description,
            genres: s.anime.genres,
            studio: s.anime.studio,
            total_episodes: s.anime.total_episodes,
            source_material: s.anime.source_material,
            content_rating: s.anime.content_rating,
            upcoming_seasons: [s.season_number],
            season_details: [detail],
          });
        }
      });

      // Sort seasons asc and dedupe
      const merged = Array.from(byAnimeId.values()).map(a => ({
        ...a,
        upcoming_seasons: Array.from(new Set(a.upcoming_seasons || [])).sort((x, y) => x - y),
      }));

      setAnimeList(merged);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const withDate = animeList.filter(a => a.season_details?.some(s => s.release_date)).length;
  const newSeasons = animeList.reduce((sum, a) => sum + (a.upcoming_seasons?.length || 0), 0);

  return (
    <AnimatedPage>
      <ContentNavTabs />
      <SeeAllHeader
        icon={Rocket}
        title="Upcoming Anime"
        subtitle="Future releases and new seasons of your favorite anime — tap any title for a live countdown."
        eyebrow="Coming Soon"
        iconGradient="from-orange-500 via-amber-500 to-yellow-500"
        glowTone="bg-orange-500/20"
        stats={[
          { icon: Layers, value: animeList.length, label: 'Titles', tone: 'text-orange-400' },
          { icon: CalendarClock, value: newSeasons, label: 'Seasons', tone: 'text-amber-400' },
          { icon: Clock, value: withDate, label: 'Dated', tone: 'text-emerald-400' },
        ]}
      />
      <div className="container px-4 pb-12">

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : animeList.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No upcoming anime yet</p>
              <p className="text-sm">Check back later for announcements!</p>
            </div>
          ) : (
            animeList.map((anime) => {
              const seasonChip =
                anime.upcoming_seasons && anime.upcoming_seasons.length > 0
                  ? anime.upcoming_seasons.map((n) => `S${n}`).join(' · ')
                  : null;
              return (
                <AnimeCardContextMenu
                  key={anime.id}
                  animeTitle={anime.title}
                  animeUrl={`/anime/${anime.id}`}
                  coverImage={anime.cover_image}
                >
                  <div
                    onClick={() => setSelectedAnime(anime)}
                    className="group relative cursor-pointer"
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                      {anime.cover_image ? (
                        <img
                          src={anime.cover_image}
                          alt={anime.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                          <span className="text-muted-foreground text-xs">No Image</span>
                        </div>
                      )}

                      {/* Coming Soon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-center px-3">
                          <CalendarClock className="h-6 w-6 text-orange-400 mx-auto mb-1" />
                          <span className="text-white text-xs font-medium leading-tight block">
                            Coming Soon
                          </span>
                          {seasonChip && (
                            <span className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-[10px] font-bold">
                              {seasonChip}
                            </span>
                          )}
                        </div>
                      </div>

                      {anime.type && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">
                          {anime.type}
                        </div>
                      )}

                      {anime.release_year && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-orange-500/90 text-[10px] font-bold text-white">
                          {anime.release_year}
                        </div>
                      )}
                    </div>

                    <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {anime.title}
                      {seasonChip && (
                        <span className="ml-1.5 text-xs text-orange-400 font-semibold">
                          • {seasonChip}
                        </span>
                      )}
                    </h3>
                  </div>
                </AnimeCardContextMenu>
              );
            })
          )}
        </div>
      </div>

      {/* Countdown dialog */}
      <UpcomingCountdownDialog
        anime={selectedAnime}
        onClose={() => setSelectedAnime(null)}
      />
    </AnimatedPage>
  );
}
