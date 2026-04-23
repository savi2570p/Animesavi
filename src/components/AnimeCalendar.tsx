import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, Heart, Sparkles, Flame, Tv, CalendarRange, Radio } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, getDay, isBefore, startOfDay } from 'date-fns';

interface ScheduleAnime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  genres: string[] | null;
  release_day: number;
  is_favorite: boolean;
  latest_episode_date: string | null;
  has_recent_upload: boolean;
  total_episodes: number | null;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AnimeCalendar() {
  const { user } = useAuth();
  const [animeList, setAnimeList] = useState<ScheduleAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'new'>('all');

  useEffect(() => {
    fetchScheduleData();
  }, [user]);

  const fetchScheduleData = async () => {
    setIsLoading(true);
    try {
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, status, genres, updated_at, schedule_day, total_episodes')
        .eq('status', 'ongoing');

      if (animeError) throw animeError;

      let userFavorites = new Set<string>();
      if (user) {
        const { data: favData } = await supabase
          .from('user_favorites')
          .select('anime_id')
          .eq('user_id', user.id);
        if (favData) {
          userFavorites = new Set(favData.map(f => f.anime_id));
        }
      }
      setFavorites(userFavorites);

      const animeWithSchedule = await Promise.all(
        (animeData || []).map(async (anime) => {
          if (!anime.id) return null;

          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', anime.id);

          let releaseDay = 0;
          let latestEpisodeDate: string | null = null;

          if ((anime as any).schedule_day !== null && (anime as any).schedule_day !== undefined) {
            releaseDay = (anime as any).schedule_day;
          } else if (seasons && seasons.length > 0) {
            const seasonIds = seasons.map(s => s.id);
            const { data: episodes } = await supabase
              .from('episodes')
              .select('created_at')
              .in('season_id', seasonIds)
              .order('created_at', { ascending: false })
              .limit(5);

            if (episodes && episodes.length > 0) {
              latestEpisodeDate = episodes[0].created_at;
              const days = episodes.map(ep => getDay(parseISO(ep.created_at)));
              const dayCount = days.reduce((acc, day) => {
                acc[day] = (acc[day] || 0) + 1;
                return acc;
              }, {} as Record<number, number>);
              releaseDay = parseInt(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '0');
            } else {
              const hash = anime.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              releaseDay = hash % 7;
            }
          } else {
            const hash = anime.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            releaseDay = hash % 7;
          }

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const hasRecentUpload = latestEpisodeDate ? parseISO(latestEpisodeDate) >= sevenDaysAgo : false;

          return {
            id: anime.id,
            title: anime.title || 'Unknown',
            cover_image: anime.cover_image,
            status: anime.status,
            genres: anime.genres,
            release_day: releaseDay,
            is_favorite: userFavorites.has(anime.id),
            latest_episode_date: latestEpisodeDate,
            has_recent_upload: hasRecentUpload,
            total_episodes: (anime as any).total_episodes ?? null,
          };
        })
      );

      setAnimeList(animeWithSchedule.filter(Boolean) as ScheduleAnime[]);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAnimeForDay = (dayIndex: number) => {
    return animeList
      .filter(anime => {
        if (anime.release_day !== dayIndex && anime.release_day !== 7) return false;
        if (activeFilter === 'favorites' && !anime.is_favorite) return false;
        if (activeFilter === 'new' && !anime.has_recent_upload) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return a.title.localeCompare(b.title);
      });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'next' ? 7 : -7;
    setWeekStart(addDays(weekStart, days));
  };

  const goToToday = () => {
    setWeekStart(startOfWeek(new Date()));
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = startOfDay(new Date());
  const totalThisWeek = weekDates.reduce((sum, _, i) => sum + getAnimeForDay(i).length, 0);
  const favCount = animeList.filter(a => a.is_favorite).length;
  const newCount = animeList.filter(a => a.has_recent_upload).length;

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-heading font-bold">Release Calendar</h2>
          </div>
          <div className="space-y-3">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-24 shrink-0" />
                <div className="flex gap-2 flex-1">
                  <Skeleton className="h-16 w-28" />
                  <Skeleton className="h-16 w-28" />
                  <Skeleton className="h-16 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/3 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="container relative">
        {/* Cinematic header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card/50 to-cyan-500/5 border border-primary/20 p-5 md:p-7 mb-6 backdrop-blur-sm">
          <div className="absolute -top-16 -right-10 w-56 h-56 bg-primary/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-cyan-500 shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.7)]">
                  <CalendarRange className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-background" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                    Release <span className="anime-gradient-text">Calendar</span>
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    <Radio className="h-2.5 w-2.5" />
                    Live
                  </span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  <span className="mx-1.5 opacity-50">•</span>
                  <span className="text-primary font-semibold">{totalThisWeek}</span> releases this week
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-card/40 backdrop-blur-sm rounded-full border border-border/40 p-1">
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')} className="h-8 w-8 rounded-full hover:bg-primary/15">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="default" size="sm" onClick={goToToday} className="h-7 px-3 rounded-full text-xs font-semibold">
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')} className="h-8 w-8 rounded-full hover:bg-primary/15">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="relative flex items-center gap-2 mt-5 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20">
            <button
              onClick={() => setActiveFilter('all')}
              className={`shrink-0 text-[11px] md:text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30 scale-105'
                  : 'bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground'
              }`}
            >
              All <span className="opacity-70 ml-1">{animeList.length}</span>
            </button>
            <button
              onClick={() => setActiveFilter('favorites')}
              className={`shrink-0 text-[11px] md:text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                activeFilter === 'favorites'
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30 scale-105'
                  : 'bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Heart className={`h-3 w-3 ${activeFilter === 'favorites' ? 'fill-current' : ''}`} />
              Favorites <span className="opacity-70">{favCount}</span>
            </button>
            <button
              onClick={() => setActiveFilter('new')}
              className={`shrink-0 text-[11px] md:text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                activeFilter === 'new'
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30 scale-105'
                  : 'bg-card/40 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <Flame className="h-3 w-3" />
              New this week <span className="opacity-70">{newCount}</span>
            </button>
          </div>
        </div>

        {/* Row-based layout */}
        <div className="space-y-1.5">
          {weekDates.map((date, dayIndex) => {
            const isToday = isSameDay(date, today);
            const isPast = isBefore(date, today) && !isToday;
            const dayAnime = getAnimeForDay(dayIndex);

            return (
              <div
                key={dayIndex}
                className={`flex items-stretch rounded-xl overflow-hidden transition-all duration-200 ${
                  isToday
                    ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent ring-1 ring-primary/40 shadow-lg shadow-primary/10'
                    : isPast
                      ? 'bg-card/20 opacity-60 hover:opacity-90'
                      : 'bg-card/30 hover:bg-card/50'
                }`}
              >
                {/* Date column */}
                <div
                  className={`shrink-0 w-14 md:w-24 flex flex-col items-center justify-center py-2 md:py-3 border-r relative ${
                    isToday
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 border-border/30'
                  }`}
                >
                  <span className="text-[9px] md:text-[11px] font-semibold uppercase tracking-wider opacity-90">
                    {DAYS_OF_WEEK[dayIndex]}
                  </span>
                  <span className="text-lg md:text-2xl font-bold leading-none mt-0.5">
                    {format(date, 'd')}
                  </span>
                  <span className={`text-[8px] md:text-[10px] mt-0.5 ${isToday ? 'opacity-90' : 'opacity-60'}`}>
                    {format(date, 'MMM')}
                  </span>
                  {isToday && (
                    <Badge variant="secondary" className="text-[7px] px-1 py-0 mt-1 h-3.5 bg-primary-foreground/20 text-primary-foreground border-0">
                      TODAY
                    </Badge>
                  )}
                </div>

                <div className="flex-1 min-w-0 py-1.5 px-2 md:px-3">
                  {dayAnime.length === 0 ? (
                    <div className="flex items-center h-full text-muted-foreground text-[10px] md:text-xs italic px-2">
                      No releases scheduled
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                      {dayAnime.map((anime) => (
                        <Link
                          key={anime.id}
                          to={`/anime/${anime.id}`}
                          className="shrink-0 group"
                        >
                          <div className="relative w-[60px] md:w-[78px]">
                            <div className="relative">
                              <img
                                src={anime.cover_image || '/placeholder.svg'}
                                alt={anime.title}
                                className={`w-[60px] h-[82px] md:w-[78px] md:h-[108px] object-cover rounded-md transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/30 ${
                                  anime.is_favorite ? 'ring-2 ring-primary' : 'ring-1 ring-border/30'
                                }`}
                                loading="lazy"
                              />
                              {/* Episode count corner badge */}
                              {anime.total_episodes != null && (
                                <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-white text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded">
                                  <Tv className="h-2 w-2" />
                                  {anime.total_episodes}
                                </div>
                              )}
                              {isToday && (
                                <div className="absolute -bottom-1 -right-1">
                                  <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]" />
                                </div>
                              )}
                              {anime.is_favorite && (
                                <div className="absolute top-1 left-1 p-0.5 bg-primary rounded-full shadow">
                                  <Heart className="h-2 w-2 text-primary-foreground fill-current" />
                                </div>
                              )}
                              {anime.has_recent_upload && (
                                <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 bg-emerald-500 rounded text-[7px] font-bold text-white shadow shadow-emerald-500/50">
                                  NEW
                                </div>
                              )}
                            </div>
                            <p className="text-[8px] md:text-[10px] font-medium line-clamp-2 mt-1 leading-tight text-center group-hover:text-primary transition-colors">
                              {anime.title}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Count badge */}
                {dayAnime.length > 0 && (
                  <div className="shrink-0 flex items-center pr-2 md:pr-3">
                    <Badge variant="outline" className={`text-[10px] h-5 ${isToday ? 'border-primary/50 text-primary' : ''}`}>
                      {dayAnime.length}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
