import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AnimeCalendar() {
  const { user } = useAuth();
  const [animeList, setAnimeList] = useState<ScheduleAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'new'>('all');
  const [selectedCountdown, setSelectedCountdown] = useState<ScheduleAnime | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { fetchScheduleData(); }, [user]);

  useEffect(() => {
    if (!selectedCountdown) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [selectedCountdown]);

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
        if (favData) userFavorites = new Set(favData.map(f => f.anime_id));
      }
      setFavorites(userFavorites);

      const animeWithSchedule = await Promise.all(
        (animeData || []).map(async (anime) => {
          if (!anime.id) return null;
          const { data: seasons } = await supabase.from('seasons').select('id').eq('anime_id', anime.id);
          let releaseDay = 0;
          let latestEpisodeDate: string | null = null;

          if ((anime as any).schedule_day === -1) {
            return null; // Hidden from calendar
          } else if ((anime as any).schedule_day !== null && (anime as any).schedule_day !== undefined) {
            releaseDay = (anime as any).schedule_day;
          } else if (seasons && seasons.length > 0) {
            const seasonIds = seasons.map(s => s.id);
            const { data: episodes } = await supabase
              .from('episodes').select('created_at').in('season_id', seasonIds)
              .order('created_at', { ascending: false }).limit(5);
            if (episodes && episodes.length > 0) {
              latestEpisodeDate = episodes[0].created_at;
              const days = episodes.map(ep => getDay(parseISO(ep.created_at)));
              const dayCount = days.reduce((acc, day) => { acc[day] = (acc[day] || 0) + 1; return acc; }, {} as Record<number, number>);
              releaseDay = parseInt(Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '0');
            } else {
              const hash = anime.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
              releaseDay = hash % 7;
            }
          } else {
            const hash = anime.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
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
    } catch (e) {
      console.error('Error fetching schedule data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const getAnimeForDay = (dayIndex: number) =>
    animeList
      .filter(a => {
        if (a.release_day !== dayIndex && a.release_day !== 7) return false;
        if (activeFilter === 'favorites' && !a.is_favorite) return false;
        if (activeFilter === 'new' && !a.has_recent_upload) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return a.title.localeCompare(b.title);
      });

  const navigateWeek = (dir: 'prev' | 'next') => setWeekStart(addDays(weekStart, dir === 'next' ? 7 : -7));
  const goToToday = () => setWeekStart(startOfWeek(new Date()));

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = startOfDay(new Date());
  const totalThisWeek = weekDates.reduce((s, _, i) => s + getAnimeForDay(i).length, 0);
  const favCount = animeList.filter(a => a.is_favorite).length;
  const newCount = animeList.filter(a => a.has_recent_upload).length;

  // Reset hour: 3 PM local (15:00). Never midnight.
  const RESET_HOUR = 15;
  const getNextReleaseDate = (anime: ScheduleAnime) => {
    const current = new Date();
    // Auto-reset: if a new episode dropped within the last 7 days,
    // base the next target on that upload + 7 days at 3 PM.
    if (anime.latest_episode_date) {
      const last = parseISO(anime.latest_episode_date);
      const sinceLast = current.getTime() - last.getTime();
      if (sinceLast >= 0 && sinceLast < 7 * 86400000) {
        const next = addDays(last, 7);
        return new Date(next.getFullYear(), next.getMonth(), next.getDate(), RESET_HOUR, 0, 0, 0);
      }
    }
    const targetDay = anime.release_day === 7 ? current.getDay() : anime.release_day;
    let daysUntil = ((targetDay % 7) - current.getDay() + 7) % 7;
    // If today is the release day but it's already past 3 PM, push to next week.
    if (daysUntil === 0 && current.getHours() >= RESET_HOUR) daysUntil = 7;
    const next = addDays(current, daysUntil);
    return new Date(next.getFullYear(), next.getMonth(), next.getDate(), RESET_HOUR, 0, 0, 0);
  };

  const formatCountdown = (target: Date) => {
    const diff = Math.max(0, target.getTime() - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds };
  };

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
                <Skeleton className="h-20 w-28 shrink-0 rounded-2xl" />
                <div className="flex gap-2 flex-1">
                  <Skeleton className="h-20 w-20 rounded-lg" />
                  <Skeleton className="h-20 w-20 rounded-lg" />
                  <Skeleton className="h-20 w-20 rounded-lg" />
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
      {/* Crimson obsidian backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/3 w-96 h-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="container relative">
        {/* Editorial header card */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-black/80 via-card/60 to-black/80 backdrop-blur-xl p-5 md:p-7 mb-6">
          <div className="absolute -top-20 -right-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-stretch gap-3.5 min-w-0">
              <div className="w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-transparent shadow-[0_0_14px_hsl(var(--primary))]" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    <CalendarRange className="h-3 w-3" />
                    Weekly Schedule
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-[2rem] font-heading font-bold leading-tight tracking-tight">
                  Release <span className="anime-gradient-text">Calendar</span>
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground/90 mt-1 flex items-center gap-1.5 flex-wrap">
                  <CalendarDays className="h-3 w-3 text-primary" />
                  {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  <span className="opacity-50">·</span>
                  <span className="text-primary font-semibold">{totalThisWeek}</span> releases this week
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full border border-white/10 p-1 self-start md:self-end shrink-0">
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')} className="h-8 w-8 rounded-full hover:bg-primary/20">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="default" size="sm" onClick={goToToday} className="h-7 px-3 rounded-full text-xs font-semibold bg-gradient-to-br from-primary to-primary/80 shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.7)]">Today</Button>
              <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')} className="h-8 w-8 rounded-full hover:bg-primary/20">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Segmented filter control */}
          <div className="relative mt-5 inline-flex items-center gap-1 p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 max-w-full overflow-x-auto scrollbar-none">
            {[
              { id: 'all' as const, label: 'All', count: animeList.length, icon: Tv },
              { id: 'favorites' as const, label: 'Favorites', count: favCount, icon: Heart },
              { id: 'new' as const, label: 'New this week', count: newCount, icon: Flame },
            ].map((f) => {
              const Icon = f.icon;
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.8)] scale-[1.02]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  aria-pressed={active}
                >
                  <Icon className={`h-3.5 w-3.5 ${active && f.id === 'favorites' ? 'fill-current' : ''} ${active ? '' : 'opacity-70'}`} />
                  {f.label}
                  <span className={`text-[10px] px-1.5 py-0 rounded-full ${active ? 'bg-black/25' : 'bg-white/5'}`}>{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>


        {/* Row-based layout */}
        <div className="space-y-2">
          {weekDates.map((date, dayIndex) => {
            const isToday = isSameDay(date, today);
            const isPast = isBefore(date, today) && !isToday;
            const dayAnime = getAnimeForDay(dayIndex);

            return (
              <div
                key={dayIndex}
                className={`group/row relative flex items-stretch rounded-2xl overflow-hidden transition-all duration-300 ${
                  isToday
                    ? 'bg-gradient-to-r from-primary/15 via-primary/5 to-transparent ring-1 ring-primary/40 shadow-lg shadow-primary/10'
                    : isPast
                      ? 'bg-card/20 opacity-60 hover:opacity-90'
                      : 'bg-card/30 hover:bg-card/50 hover:ring-1 hover:ring-border/60'
                }`}
              >
                {/* Vertical accent bar */}
                <div className={`shrink-0 w-1 ${
                  isToday
                    ? 'bg-gradient-to-b from-primary via-primary to-cyan-500'
                    : isPast ? 'bg-border/40' : 'bg-border/30 group-hover/row:bg-primary/40'
                }`} />

                {/* Date column - elevated card */}
                <div className={`shrink-0 w-16 md:w-28 flex flex-col items-center justify-center py-3 md:py-4 relative ${
                  isToday
                    ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                    : 'bg-gradient-to-br from-muted/50 to-muted/20'
                }`}>
                  <span className={`text-[9px] md:text-[11px] font-bold uppercase tracking-[0.15em] ${
                    isToday ? 'text-primary-foreground/90' : 'text-muted-foreground'
                  }`}>
                    {DAYS_OF_WEEK[dayIndex]}
                  </span>

                  <div className={`relative mt-1 flex items-center justify-center ${
                    isToday ? 'w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-foreground/15 backdrop-blur-sm' : ''
                  }`}>
                    <span className={`font-heading font-black leading-none ${
                      isToday ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl text-foreground'
                    }`}>
                      {format(date, 'd')}
                    </span>
                  </div>

                  <span className={`text-[8px] md:text-[10px] mt-1 font-semibold uppercase tracking-wider ${
                    isToday ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                  }`}>
                    {format(date, 'MMM')}
                  </span>

                  {isToday && (
                    <span className="mt-1.5 px-1.5 py-0.5 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-wider bg-primary-foreground text-primary shadow-md">
                      Today
                    </span>
                  )}

                  {dayAnime.length > 0 && !isToday && (
                    <span className={`mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold ${
                      isPast ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary border border-primary/30'
                    }`}>
                      {dayAnime.length} {dayAnime.length === 1 ? 'release' : 'releases'}
                    </span>
                  )}
                  {dayAnime.length > 0 && isToday && (
                    <span className="mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold bg-primary-foreground/20 text-primary-foreground">
                      {dayAnime.length} live
                    </span>
                  )}
                </div>

                {/* Anime row */}
                <div className="flex-1 min-w-0 py-2 px-2 md:px-4">
                  {dayAnime.length === 0 ? (
                    <div className="flex items-center h-full text-muted-foreground text-[10px] md:text-xs italic px-2">
                      <span className="hidden md:inline mr-1">{DAYS_FULL[dayIndex]} —</span>
                      No releases scheduled
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                      {dayAnime.map((anime) => (
                        <button key={anime.id} type="button" onClick={() => { setSelectedCountdown(anime); setNow(Date.now()); }} className="shrink-0 group text-left touch-manipulation">
                          <div className="relative w-[64px] md:w-[82px]">
                            <div className="relative">
                              <img
                                src={anime.cover_image || '/placeholder.svg'}
                                alt={anime.title}
                                className={`w-[64px] h-[88px] md:w-[82px] md:h-[114px] object-cover rounded-lg transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-primary/30 ${
                                  anime.is_favorite ? 'ring-2 ring-primary' : 'ring-1 ring-border/30'
                                }`}
                                loading="lazy"
                              />
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
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCountdown && (() => {
        const target = getNextReleaseDate(selectedCountdown);
        const c = formatCountdown(target);
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 backdrop-blur-md p-4" onClick={() => setSelectedCountdown(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-2xl p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Next Episode Countdown</p>
                  <h3 className="text-lg font-bold text-foreground leading-tight mt-1">{selectedCountdown.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Resets weekly after release day • {DAYS_FULL[selectedCountdown.release_day === 7 ? new Date().getDay() : selectedCountdown.release_day]}</p>
                </div>
                <button type="button" onClick={() => setSelectedCountdown(null)} className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close">×</button>
              </div>

              <div className="grid grid-cols-4 gap-2 my-5">
                {[
                  { v: c.days, l: 'Days' },
                  { v: c.hours, l: 'Hrs' },
                  { v: c.minutes, l: 'Min' },
                  { v: c.seconds, l: 'Sec' },
                ].map((item) => (
                  <div key={item.l} className="rounded-xl bg-primary/10 border border-primary/20 py-3 text-center">
                    <div className="text-xl font-black tabular-nums text-primary">{String(item.v).padStart(2, '0')}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{item.l}</div>
                  </div>
                ))}
              </div>

              <Link to={`/anime/${selectedCountdown.id}`} className="block w-full rounded-xl bg-primary text-primary-foreground text-center text-sm font-bold py-3 hover:opacity-90 transition">
                Open Series
              </Link>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
