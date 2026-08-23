import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEO } from '@/components/SEO';
import { CalendarDays, Clock, Flame, Globe, Search, Sparkles, Tv } from 'lucide-react';
import { parseISO } from 'date-fns';
import {
  getStoredTimeZone,
  storeTimeZone,
  getZonedParts,
  nextZonedSlot,
  getCommonTimeZones,
  getAllTimeZones,
  getTimeZoneLabel,
  formatTimeZoneName,
  zonedWallClockToDate,
} from '@/lib/timezone';

interface ScheduleAnime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
  schedule_day: number | null;
  latest_episode_date: string;
  season_number: number;
  next_episode: number;
}

interface ScheduleRow extends ScheduleAnime {
  release_day: number;
  release_hour: number;
  release_minute: number;
  languages: string[];
  next: Date;
}

interface UpcomingRow {
  id: string;
  anime_id: string;
  title: string;
  cover_image: string | null;
  languages: string[];
  season_number: number;
  release_date: string | null;
}

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Audio/language tags that may appear inside an anime's genre list. */
const LANGUAGE_TAGS = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Punjabi',
  'Urdu',
  'English',
  'Japanese',
  'Korean',
  'Chinese',
  'Spanish',
  'Portuguese',
  'French',
  'German',
];

/** Languages actually tagged on the anime, in canonical order. */
function getLanguages(genres: string[] | null): string[] {
  if (!genres?.length) return [];
  const set = new Set(genres.map((g) => g.trim().toLowerCase()));
  return LANGUAGE_TAGS.filter((lang) => set.has(lang.toLowerCase()));
}

function formatTime(hour: number, minute: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/** Next occurrence of the anime's weekly slot, in the viewer's timezone. */
function getNextRelease(
  anime: { latest_episode_date: string; release_day: number; release_hour: number; release_minute: number },
  timeZone: string,
) {
  const now = new Date();
  const last = parseISO(anime.latest_episode_date);
  const since = now.getTime() - last.getTime();
  if (since >= 0 && since < 7 * 86400000) {
    return nextZonedSlot(last, 7, anime.release_hour, anime.release_minute, timeZone);
  }

  const nowParts = getZonedParts(now, timeZone);
  let daysUntil = ((anime.release_day % 7) - nowParts.weekday + 7) % 7;
  const slotToday = nextZonedSlot(now, 0, anime.release_hour, anime.release_minute, timeZone);
  if (daysUntil === 0 && now.getTime() >= slotToday.getTime()) daysUntil = 7;
  return nextZonedSlot(now, daysUntil, anime.release_hour, anime.release_minute, timeZone);
}

function Countdown({ target, now, label = 'Next Episode' }: { target: Date; now: number; label?: string }) {
  const diff = Math.max(0, target.getTime() - now);
  const parts = [
    { v: Math.floor(diff / 86400000), l: 'Days' },
    { v: Math.floor((diff % 86400000) / 3600000), l: 'Hrs' },
    { v: Math.floor((diff % 3600000) / 60000), l: 'Min' },
    { v: Math.floor((diff % 60000) / 1000), l: 'Sec' },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-3 md:p-4 w-full md:w-[340px] shrink-0">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2.5">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        {parts.map((p) => (
          <div
            key={p.l}
            className="rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.06] to-transparent py-2 text-center"
          >
            <div className="font-heading text-lg md:text-2xl font-black leading-none tabular-nums">
              {String(p.v).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {p.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function Schedule() {
  const [animeList, setAnimeList] = useState<ScheduleAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<'all' | number>('all');
  const [now, setNow] = useState(Date.now());
  const [timeZone, setTimeZone] = useState<string>(() => getStoredTimeZone());
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [rollovers, setRollovers] = useState<Record<string, number>>({});

  const commonZones = useMemo(() => getCommonTimeZones(), []);
  const allZones = useMemo(() => getAllTimeZones().filter((z) => !commonZones.includes(z)), [commonZones]);
  const tzLabel = useMemo(() => getTimeZoneLabel(timeZone), [timeZone]);

  const handleTimeZoneChange = (tz: string) => {
    setTimeZone(tz);
    storeTimeZone(tz);
  };

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);


  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const { data: ongoing } = await supabase
          .from('anime')
          .select('id, title, cover_image, genres, schedule_day, updated_at')
          .eq('status', 'ongoing')
          .order('updated_at', { ascending: false });

        const visible = (ongoing || []).filter((a) => a.id && a.schedule_day !== -1);
        if (visible.length === 0) {
          if (!cancelled) { setAnimeList([]); setIsLoading(false); }
          return;
        }

        const animeIds = visible.map((a) => a.id as string);
        const { data: seasons } = await supabase
          .from('seasons')
          .select('id, anime_id, season_number')
          .in('anime_id', animeIds);

        const seasonIds = (seasons || []).map((s) => s.id);
        const seasonMeta = new Map((seasons || []).map((s) => [s.id, s]));

        const { data: episodes } = seasonIds.length
          ? await supabase
              .from('episodes')
              .select('season_id, episode_number, created_at')
              .in('season_id', seasonIds)
              .order('created_at', { ascending: false })
          : { data: [] as any[] };

        // Latest episode per anime + highest season/episode numbers
        const agg = new Map<string, { latest: string; season: number; ep: number }>();
        (episodes || []).forEach((ep: any) => {
          const meta = seasonMeta.get(ep.season_id);
          if (!meta?.anime_id) return;
          const existing = agg.get(meta.anime_id);
          if (!existing) {
            agg.set(meta.anime_id, {
              latest: ep.created_at,
              season: meta.season_number ?? 1,
              ep: ep.episode_number ?? 1,
            });
          }
        });

        const list: ScheduleAnime[] = visible
          .filter((a) => agg.has(a.id as string))
          .map((a) => {
            const info = agg.get(a.id as string)!;
            return {
              id: a.id as string,
              title: a.title || 'Unknown',
              cover_image: a.cover_image,
              genres: a.genres,
              schedule_day:
                a.schedule_day !== null && a.schedule_day !== undefined && a.schedule_day !== 7
                  ? a.schedule_day
                  : null,
              season_number: info.season,
              next_episode: (info.ep || 0) + 1,
              latest_episode_date: info.latest,
            };
          });

        if (!cancelled) setAnimeList(list);
      } catch (e) {
        console.error('Schedule load failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Upcoming seasons (announced date optional)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('seasons')
          .select('id, season_number, release_date, anime:anime_id (id, title, cover_image, genres)')
          .eq('is_upcoming', true)
          .order('release_date', { ascending: true, nullsFirst: false });

        const list: UpcomingRow[] = (data || [])
          .filter((s: any) => s.anime?.id)
          .map((s: any) => ({
            id: s.id,
            anime_id: s.anime.id,
            title: s.anime.title || 'Unknown',
            cover_image: s.anime.cover_image,
            languages: getLanguages(s.anime.genres),
            season_number: s.season_number ?? 1,
            release_date: s.release_date ?? null,
          }));

        if (!cancelled) setUpcoming(list);
      } catch (e) {
        console.error('Upcoming load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Base weekly slots, independent of the ticking clock. */
  const baseRows = useMemo<ScheduleRow[]>(() => {
    return animeList.map((a) => {
      const lastParts = getZonedParts(parseISO(a.latest_episode_date), timeZone);
      const release_hour = lastParts.hour;
      const release_minute = lastParts.minute - (lastParts.minute % 15);
      const release_day = a.schedule_day ?? lastParts.weekday;
      const base = { ...a, release_day, release_hour, release_minute };
      return {
        ...base,
        languages: getLanguages(a.genres),
        next: getNextRelease(base, timeZone),
      };
    });
  }, [animeList, timeZone]);

  // Reset rollovers whenever the source data or timezone changes.
  useEffect(() => {
    setRollovers({});
  }, [animeList, timeZone]);

  // When a countdown hits zero, roll the slot forward a week (moves it to the end).
  useEffect(() => {
    setRollovers((prev) => {
      let changed = false;
      const updated = { ...prev };
      baseRows.forEach((r) => {
        const current = updated[r.id] ?? r.next.getTime();
        if (current <= now) {
          let d = new Date(current);
          let guard = 0;
          while (d.getTime() <= now && guard++ < 60) {
            d = nextZonedSlot(d, 7, r.release_hour, r.release_minute, timeZone);
          }
          updated[r.id] = d.getTime();
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [now, baseRows, timeZone]);

  const rows = useMemo<ScheduleRow[]>(() => {
    return baseRows
      .map((r) => {
        const next = new Date(rollovers[r.id] ?? r.next.getTime());
        // The weekday label always matches the actual next airing in the viewer's timezone.
        return { ...r, next, release_day: getZonedParts(next, timeZone).weekday };
      })
      .filter((a) => (dayFilter === 'all' ? true : a.release_day === dayFilter))
      .filter((a) => (search ? a.title.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => a.next.getTime() - b.next.getTime());
  }, [baseRows, rollovers, dayFilter, search, timeZone]);

  const upcomingRows = useMemo(() => {
    return upcoming
      .map((u) => {
        const [y, m, d] = u.release_date.split('-').map(Number);
        return { ...u, target: zonedWallClockToDate(y, m, d, 0, 0, timeZone) };
      })
      .filter((u) => u.target.getTime() > now - 86400000)
      .filter((u) => (search ? u.title.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => a.target.getTime() - b.target.getTime());
  }, [upcoming, search, timeZone, now]);

  const todayIdx = getZonedParts(new Date(now), timeZone).weekday;



  return (
    <div className="container py-6 md:py-10">
      <SEO
        title="Anime Release Schedule - AnimeSavi"
        description="Live weekly anime release schedule with countdowns to the next episode of every ongoing series in Hindi dub."
        path="/schedule"
      />

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-black/80 via-card/60 to-black/80 backdrop-blur-xl p-5 md:p-7 mb-5">
        <div className="absolute -top-20 -right-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-stretch gap-3.5 min-w-0">
            <div className="w-[3px] rounded-full bg-gradient-to-b from-primary via-primary/80 to-transparent shadow-[0_0_14px_hsl(var(--primary))]" />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                <CalendarDays className="h-3 w-3" />
                Weekly Schedule
              </span>
              <h1 className="text-2xl md:text-3xl font-heading font-bold leading-tight tracking-tight mt-1.5">
                Anime <span className="anime-gradient-text">Schedule</span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Live countdowns to the next episode of every ongoing series.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-72">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ongoing anime..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-black/40 border-white/10"
              />
            </div>
            <Select value={timeZone} onValueChange={handleTimeZoneChange}>
              <SelectTrigger
                aria-label="Time zone"
                className="h-10 rounded-xl bg-black/40 border-white/10 text-xs flex-1"
              >
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectGroup>
                  <SelectLabel>Common</SelectLabel>
                  {commonZones.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-xs">
                      {formatTimeZoneName(tz)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {allZones.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>All time zones</SelectLabel>
                    {allZones.map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-xs">
                        {formatTimeZoneName(tz)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Day filter */}
        <div className="relative mt-4 flex items-center gap-1 p-1 rounded-2xl bg-black/40 border border-white/5 overflow-x-auto scrollbar-none">
          {[{ id: 'all' as const, label: 'All' }, ...DAYS_FULL.map((d, i) => ({ id: i, label: d.slice(0, 3) }))].map(
            (f) => {
              const active = dayFilter === f.id;
              return (
                <button
                  key={String(f.id)}
                  onClick={() => setDayFilter(f.id as 'all' | number)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.8)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  aria-pressed={active}
                >
                  {f.label}
                  {f.id === todayIdx && <span className="ml-1 text-[9px] opacity-70">•</span>}
                </button>
              );
            },
          )}
        </div>

        <p className="relative mt-2.5 text-[11px] text-muted-foreground">
          Days, times and countdowns shown in{' '}
          <span className="font-semibold text-foreground">{formatTimeZoneName(timeZone)}</span>
          {tzLabel ? ` (${tzLabel})` : ''}
        </p>
      </div>


      {/* Section title */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl px-4 py-3 mb-4 border-l-[3px] border-l-primary">
        <Flame className="h-4 w-4 text-primary" />
        <h2 className="text-base md:text-lg font-bold">Ongoing Releases</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} series</span>
      </div>

      {/* Rows */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-[150px] w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
          <Tv className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No releases scheduled</h3>
          <p className="text-sm text-muted-foreground">Try a different day or clear your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((anime) => (
            <div
              key={anime.id}
              className="group relative rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-3 md:p-4 transition-all hover:border-primary/40 hover:bg-card/60"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <Link to={`/anime/${anime.id}`} className="flex gap-3 md:gap-4 flex-1 min-w-0">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={`${anime.title} poster`}
                    loading="lazy"
                    className="w-[92px] h-[138px] md:w-[120px] md:h-[180px] object-cover rounded-xl shrink-0 shadow-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-xl font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {anime.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold">
                        Season {anime.season_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold">
                        EP {anime.next_episode}
                      </span>
                    </div>

                    {anime.languages.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {anime.languages.map((lang, i) => (
                          <span
                            key={lang}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                              i === 0
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                : 'bg-white/5 border-white/10 text-muted-foreground'
                            }`}
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}


                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold">
                        <CalendarDays className="h-3 w-3 text-primary" />
                        {DAYS_FULL[anime.release_day]}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold">
                        <Clock className="h-3 w-3 text-primary" />
                        {formatTime(anime.release_hour, anime.release_minute)}
                      </span>
                    </div>
                  </div>
                </Link>

                <Countdown target={anime.next} now={now} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcomingRows.length > 0 && (
        <>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl px-4 py-3 mt-8 mb-4 border-l-[3px] border-l-primary">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base md:text-lg font-bold">Upcoming</h2>
            <span className="ml-auto text-xs text-muted-foreground">{upcomingRows.length} titles</span>
          </div>

          <div className="space-y-3">
            {upcomingRows.map((u) => (
              <div
                key={u.id}
                className="group relative rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-3 md:p-4 transition-all hover:border-primary/40 hover:bg-card/60"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <Link to={`/anime/${u.anime_id}`} className="flex gap-3 md:gap-4 flex-1 min-w-0">
                    <img
                      src={u.cover_image || '/placeholder.svg'}
                      alt={`${u.title} poster`}
                      loading="lazy"
                      className="w-[92px] h-[138px] md:w-[120px] md:h-[180px] object-cover rounded-xl shrink-0 shadow-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-[0.14em]">
                        Upcoming
                      </span>
                      <h3 className="text-base md:text-xl font-bold leading-tight line-clamp-2 mt-1.5 group-hover:text-primary transition-colors">
                        {u.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold">
                          Season {u.season_number}
                        </span>
                      </div>

                      {u.languages.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {u.languages.map((lang, i) => (
                            <span
                              key={lang}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                i === 0
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                  : 'bg-white/5 border-white/10 text-muted-foreground'
                              }`}
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold">
                          <CalendarDays className="h-3 w-3 text-primary" />
                          {u.target.toLocaleDateString(undefined, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            timeZone,
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <Countdown target={u.target} now={now} label="Premieres In" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}


      <div className="mt-8 text-center">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/browse">Browse all anime</Link>
        </Button>
      </div>
    </div>
  );
}
