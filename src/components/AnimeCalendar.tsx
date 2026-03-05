import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Play, ChevronLeft, ChevronRight, Heart, Sparkles } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, getDay } from 'date-fns';

interface ScheduleAnime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  genres: string[] | null;
  release_day: number; // 0-6 (Sunday-Saturday)
  is_favorite: boolean;
  latest_episode_date: string | null;
  has_recent_upload: boolean; // uploaded within last 7 days
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
      // Fetch ongoing anime
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, status, genres, updated_at, schedule_day')
        .eq('status', 'ongoing');

      if (animeError) throw animeError;

      // Fetch user favorites if logged in
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

      // Get latest episode dates for each anime to determine release pattern
      const animeWithSchedule = await Promise.all(
        (animeData || []).map(async (anime) => {
          if (!anime.id) return null;

          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', anime.id);

          let releaseDay = 0;
          let latestEpisodeDate: string | null = null;

          // Use schedule_day override if set
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

          // Check if latest episode was uploaded within last 7 days
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
      .filter(anime => anime.release_day === dayIndex)
      .sort((a, b) => {
        // Sort favorites first
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
          <div className="grid grid-cols-7 gap-2">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
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

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
            <span className="text-muted-foreground">Tomorrow / Yesterday</span>
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {weekDates.map((date, dayIndex) => {
            const isToday = isSameDay(date, today);
            const dayAnime = getAnimeForDay(dayIndex);
            
            return (
              <div key={dayIndex} className="min-h-[200px]">
                {/* Day Header */}
                <div
                  className={`text-center p-2 rounded-t-lg border-b ${
                    isToday 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-card/50'
                  }`}
                >
                  <span className="text-xs font-medium block">{DAYS_OF_WEEK[dayIndex]}</span>
                  <span className={`text-lg font-bold ${isToday ? '' : 'text-foreground'}`}>
                    {format(date, 'd')}
                  </span>
                </div>

                {/* Anime List */}
                <div className="space-y-1 p-1 bg-card/30 rounded-b-lg min-h-[160px]">
                  {dayAnime.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-muted-foreground text-xs">
                      No releases
                    </div>
                  ) : (
                    dayAnime.slice(0, 5).map((anime) => (
                      <Link
                        key={anime.id}
                        to={`/anime/${anime.id}`}
                        className={`block p-1.5 rounded-lg transition-all hover:scale-[1.02] relative overflow-hidden ${
                          anime.has_recent_upload
                            ? 'bg-primary/25 border border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.4)] animate-pulse-glow'
                            : anime.is_favorite
                              ? 'bg-primary/20 border border-primary/30 hover:bg-primary/30'
                              : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        {anime.has_recent_upload && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer bg-[length:200%_100%] pointer-events-none" />
                        )}
                        <div className="flex items-center gap-1.5 relative z-10">
                          <img
                            src={anime.cover_image || '/placeholder.svg'}
                            alt={anime.title}
                            className={`w-8 h-10 object-cover rounded flex-shrink-0 ${
                              anime.has_recent_upload ? 'ring-1 ring-primary/60' : ''
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] md:text-xs font-medium line-clamp-2 leading-tight">
                              {anime.title}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {anime.has_recent_upload && (
                                <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
                              )}
                              {anime.is_favorite && (
                                <Heart className="h-2.5 w-2.5 text-primary fill-primary" />
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                  {dayAnime.length > 5 && (
                    <div className="text-center text-xs text-muted-foreground py-1">
                      +{dayAnime.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile View - Scrollable */}
        <div className="md:hidden mt-4 space-y-3">
          {weekDates.map((date, dayIndex) => {
            const isToday = isSameDay(date, today);
            const dayAnime = getAnimeForDay(dayIndex);
            
            if (dayAnime.length === 0) return null;
            
            return (
              <Card key={dayIndex} className={isToday ? 'border-primary' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>
                        {FULL_DAYS[dayIndex]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(date, 'MMM d')}
                      </span>
                      {isToday && (
                        <Badge variant="default" className="text-xs">Today</Badge>
                      )}
                    </div>
                    <Badge variant="outline">{dayAnime.length}</Badge>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {dayAnime.map((anime) => (
                      <Link
                        key={anime.id}
                        to={`/anime/${anime.id}`}
                        className={`flex-shrink-0 w-20 ${anime.has_recent_upload ? 'relative' : ''}`}
                      >
                        <div className="relative">
                          <img
                            src={anime.cover_image || '/placeholder.svg'}
                            alt={anime.title}
                            className={`w-20 h-28 object-cover rounded-lg ${
                              anime.has_recent_upload
                                ? 'ring-2 ring-primary shadow-[0_0_14px_hsl(var(--primary)/0.5)] animate-pulse-glow'
                                : anime.is_favorite ? 'ring-2 ring-primary' : ''
                            }`}
                          />
                          {anime.has_recent_upload && (
                            <div className="absolute -top-1 -right-1 p-0.5 bg-primary rounded-full animate-pulse">
                              <Sparkles className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          {anime.is_favorite && !anime.has_recent_upload && (
                            <div className="absolute top-1 right-1 p-0.5 bg-primary rounded-full">
                              <Heart className="h-2.5 w-2.5 text-primary-foreground fill-current" />
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] font-medium line-clamp-2 mt-1 text-center">
                          {anime.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
