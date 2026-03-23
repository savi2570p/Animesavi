import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ChevronLeft, ChevronRight, Heart, Sparkles } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, getDay } from 'date-fns';

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
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AnimeCalendar() {
  const { user } = useAuth();
  const [animeList, setAnimeList] = useState<ScheduleAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchScheduleData();
  }, [user]);

  const fetchScheduleData = async () => {
    setIsLoading(true);
    try {
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, status, genres, updated_at, schedule_day')
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
            has_recent_upload: hasRecentUpload
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
      .filter(anime => anime.release_day === dayIndex || anime.release_day === 7)
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
  const today = new Date();

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
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
    <section className="py-8">
      <div className="container">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold">Release Calendar</h2>
              <p className="text-sm text-muted-foreground">
                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Row-based layout: Date on left, anime scrolling horizontally */}
        <div className="space-y-1">
          {weekDates.map((date, dayIndex) => {
            const isToday = isSameDay(date, today);
            const dayAnime = getAnimeForDay(dayIndex);

            return (
              <div
                key={dayIndex}
                className={`flex items-stretch rounded-lg overflow-hidden transition-colors ${
                  isToday ? 'bg-primary/5 ring-1 ring-primary/30' : 'bg-card/30 hover:bg-card/50'
                }`}
              >
                {/* Left: Date column */}
                <div
                  className={`shrink-0 w-12 md:w-20 flex flex-col items-center justify-center py-1.5 md:py-2 border-r ${
                    isToday
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 border-border/30'
                  }`}
                >
                  <span className="text-[8px] md:text-[10px] font-medium uppercase tracking-wider opacity-80">
                    {DAYS_OF_WEEK[dayIndex]}
                  </span>
                  <span className="text-base md:text-xl font-bold leading-none mt-0.5">
                    {format(date, 'd')}
                  </span>
                  {isToday && (
                    <Badge variant="default" className="text-[7px] px-1 py-0 mt-0.5 h-3">
                      TODAY
                    </Badge>
                  )}
                </div>

                <div className="flex-1 min-w-0 py-1 px-1.5 md:px-2">
                  {dayAnime.length === 0 ? (
                    <div className="flex items-center h-full text-muted-foreground text-[10px] px-2">
                      —
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                      {dayAnime.map((anime) => (
                        <Link
                          key={anime.id}
                          to={`/anime/${anime.id}`}
                          className="shrink-0 group"
                        >
                          <div className="relative w-[55px] md:w-[70px]">
                            <div className="relative">
                              <img
                                src={anime.cover_image || '/placeholder.svg'}
                                alt={anime.title}
                                className={`w-[55px] h-[75px] md:w-[70px] md:h-[95px] object-cover rounded transition-transform duration-200 group-hover:scale-105 ${
                                  anime.is_favorite ? 'ring-2 ring-primary' : ''
                                }`}
                                loading="lazy"
                              />
                              {isToday && (
                                <div className="absolute -bottom-1 -right-1">
                                  <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]" />
                                </div>
                              )}
                              {anime.is_favorite && (
                                <div className="absolute top-1 left-1 p-0.5 bg-primary rounded-full">
                                  <Heart className="h-2 w-2 text-primary-foreground fill-current" />
                                </div>
                              )}
                              {anime.has_recent_upload && (
                                <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              )}
                            </div>
                            <p className="text-[9px] md:text-[10px] font-medium line-clamp-2 mt-1 leading-tight text-center group-hover:text-primary transition-colors">
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
                    <Badge variant="outline" className="text-[10px] h-5">
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
