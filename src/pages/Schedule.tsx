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
import { PosterCard } from '@/components/anime/PosterCard';
import { CalendarDays, Flame, Globe, Search, Sparkles, Tv } from 'lucide-react';
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
  is_daily: boolean;
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
  genres: string[] | null;
  is_eng_dub: boolean | null;
  is_sub_only: boolean | null;
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

/** Next daily slot (24-hour cycle) in the viewer's timezone. */
function getNextDailyRelease(hour: number, minute: number, timeZone: string) {
  const now = new Date();
  const slotToday = nextZonedSlot(now, 0, hour, minute, timeZone);
  if (slotToday.getTime() > now.getTime()) return slotToday;
  return nextZonedSlot(now, 1, hour, minute, timeZone);
}

function splitDiff(diff: number) {
  const d = Math.max(0, diff);
  return {
    days: Math.floor(d / 86400000),
    hours: Math.floor((d % 86400000) / 3600000),
    minutes: Math.floor((d % 3600000) / 60000),
    seconds: Math.floor((d % 60000) / 1000),
  };
}
const pad = (n: number) => String(n).padStart(2, '0');

/** Compact live countdown pill: "2d 04h 13m" (seconds once under a day). */
function CountdownPill({ target, now }: { target: Date; now: number }) {
  const diff = target.getTime() - now;
  const { days, hours, minutes, seconds } = splitDiff(diff);
  const soon = diff < 3600000;
  const text = days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
    : hours > 0
      ? `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
      : `${pad(minutes)}m ${pad(seconds)}s`;
  return (
    <span className={`sch2-pill${soon ? ' is-soon' : ''}`}>
      <span className="sch2-pill-dot" aria-hidden />
      <span className="sr-only">Airs in </span>
      {text}
    </span>
  );
}

/** Large segmented countdown for the "Next to air" spotlight. */
function CountdownBlocks({ target, now }: { target: Date; now: number }) {
  const { days, hours, minutes, seconds } = splitDiff(target.getTime() - now);
  const parts = [
    { v: days, l: 'Days' },
    { v: hours, l: 'Hours' },
    { v: minutes, l: 'Min' },
    { v: seconds, l: 'Sec' },
  ];
  return (
    <div className="sch2-blocks" role="timer">
      {parts.map((p) => (
        <div key={p.l} className="sch2-block">
          <span className="sch2-block-v">{pad(p.v)}</span>
          <span className="sch2-block-l">{p.l}</span>
        </div>
      ))}
    </div>
  );
}

/** YYYY-MM-DD key of a date in the viewer's time zone. */
function dayKey(date: Date, timeZone: string) {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
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
              is_daily: a.schedule_day === 7,
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
          .select('id, season_number, release_date, anime:anime_id (id, title, cover_image, genres, is_eng_dub, is_sub_only)')
          .eq('is_upcoming', true)
          .order('release_date', { ascending: true, nullsFirst: false });

        const list: UpcomingRow[] = (data || [])
          .filter((s: any) => s.anime?.id)
          .map((s: any) => ({
            id: s.id,
            anime_id: s.anime.id,
            title: s.anime.title || 'Unknown',
            cover_image: s.anime.cover_image,
            genres: s.anime.genres ?? null,
            is_eng_dub: s.anime.is_eng_dub ?? null,
            is_sub_only: s.anime.is_sub_only ?? null,
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
      const next = a.is_daily
        ? getNextDailyRelease(release_hour, release_minute, timeZone)
        : getNextRelease(base, timeZone);
      return {
        ...base,
        languages: getLanguages(a.genres),
        next,
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
          const step = r.is_daily ? 1 : 7;
          while (d.getTime() <= now && guard++ < 400) {
            d = nextZonedSlot(d, step, r.release_hour, r.release_minute, timeZone);
          }
          updated[r.id] = d.getTime();
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [now, baseRows, timeZone]);

  /** Every ongoing slot with rollovers applied, soonest first (no filters). */
  const allRows = useMemo<ScheduleRow[]>(() => {
    return baseRows
      .map((r) => {
        const next = new Date(rollovers[r.id] ?? r.next.getTime());
        // The weekday label always matches the actual next airing in the viewer's timezone.
        return { ...r, next, release_day: getZonedParts(next, timeZone).weekday };
      })
      .sort((a, b) => a.next.getTime() - b.next.getTime());
  }, [baseRows, rollovers, timeZone]);

  const rows = useMemo<ScheduleRow[]>(() => {
    const q = search.toLowerCase();
    return allRows
      .filter((a) => (dayFilter === 'all' || a.is_daily ? true : a.release_day === dayFilter))
      .filter((a) => (q ? a.title.toLowerCase().includes(q) : true));
  }, [allRows, dayFilter, search]);

  const upcomingRows = useMemo(() => {
    return upcoming
      .map((u) => {
        if (!u.release_date) return { ...u, target: null as Date | null };
        const [y, m, d] = u.release_date.split('-').map(Number);
        return { ...u, target: zonedWallClockToDate(y, m, d, 0, 0, timeZone) };
      })
      .filter((u) => !u.target || u.target.getTime() > now - 86400000)
      .filter((u) => (search ? u.title.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => {
        // Announced dates first (soonest → latest), unannounced titles last
        if (!a.target && !b.target) return a.title.localeCompare(b.title);
        if (!a.target) return 1;
        if (!b.target) return -1;
        return a.target.getTime() - b.target.getTime();
      });
  }, [upcoming, search, timeZone, now]);


  const todayIdx = getZonedParts(new Date(now), timeZone).weekday;
  const todayKey = dayKey(new Date(now), timeZone);
  const tomorrowKey = dayKey(new Date(now + 86400000), timeZone);

  /** Next seven days starting today, in the viewer's time zone. */
  const weekTabs = useMemo(() => {
    const start = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start + i * 86400000);
      const parts = getZonedParts(date, timeZone);
      const count = allRows.filter((r) => r.is_daily || r.release_day === parts.weekday).length;
      return { weekday: parts.weekday, date: parts.day, count, isToday: i === 0 };
    });
    // Recompute when the viewer's day changes, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, timeZone, todayKey]);

  const spotlight = !search && dayFilter === 'all' ? allRows[0] : undefined;

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; date: Date; items: ScheduleRow[] }>();
    rows.forEach((r) => {
      const key = dayFilter === 'all' ? dayKey(r.next, timeZone) : 'filtered';
      if (!map.has(key)) map.set(key, { key, date: r.next, items: [] });
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values());
  }, [rows, dayFilter, timeZone]);

  const groupLabel = (g: { key: string; date: Date }) => {
    if (g.key === 'filtered') return { title: DAYS_FULL[dayFilter as number], sub: dayFilter === todayIdx ? 'Today' : '' };
    const sub = g.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone });
    if (g.key === todayKey) return { title: 'Today', sub };
    if (g.key === tomorrowKey) return { title: 'Tomorrow', sub };
    return { title: DAYS_FULL[getZonedParts(g.date, timeZone).weekday], sub };
  };

  const airingToday = allRows.filter((r) => dayKey(r.next, timeZone) === todayKey).length;

  return (
    <div className="sch2 container py-6 md:py-10">
      <SEO
        title="Anime Release Schedule - AnimeSavi"
        description="Live weekly anime release schedule with countdowns to the next episode of every ongoing series in Hindi dub."
        path="/schedule"
      />

      {/* Header */}
      <header className="sch2-head">
        <div className="min-w-0">
          <p className="sch2-eyebrow"><CalendarDays aria-hidden /> Release schedule</p>
          <h1 className="sch2-h1">Schedule</h1>
          <p className="sch2-lead">Live countdowns to the next episode of every ongoing series.</p>
          <div className="sch2-stats">
            <span><b>{allRows.length}</b> airing</span>
            <span><b>{airingToday}</b> today</span>
            <span><b>{upcomingRows.length}</b> upcoming</span>
          </div>
        </div>
        <div className="sch2-tools">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ongoing anime..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sch2-input pl-9"
              aria-label="Search schedule"
            />
          </div>
          <Select value={timeZone} onValueChange={handleTimeZoneChange}>
            <SelectTrigger aria-label="Time zone" className="sch2-input text-xs">
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectGroup>
                <SelectLabel>Common</SelectLabel>
                {commonZones.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-xs">{formatTimeZoneName(tz)}</SelectItem>
                ))}
              </SelectGroup>
              {allZones.length > 0 && (
                <SelectGroup>
                  <SelectLabel>All time zones</SelectLabel>
                  {allZones.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-xs">{formatTimeZoneName(tz)}</SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <p className="sch2-tz">
            Times in <b>{formatTimeZoneName(timeZone)}</b>{tzLabel ? ` (${tzLabel})` : ''}
          </p>
        </div>
      </header>

      {/* Week strip */}
      <nav className="sch2-week snap-row" aria-label="Filter by day">
        <button
          type="button"
          className={`sch2-day sch2-day-all${dayFilter === 'all' ? ' is-active' : ''}`}
          aria-pressed={dayFilter === 'all'}
          onClick={() => setDayFilter('all')}
        >
          <span className="sch2-day-name">All</span>
          <span className="sch2-day-num">{allRows.length}</span>
          <span className="sch2-day-count">titles</span>
        </button>
        {weekTabs.map((t) => {
          const active = dayFilter === t.weekday;
          return (
            <button
              key={t.weekday}
              type="button"
              className={`sch2-day${active ? ' is-active' : ''}${t.isToday ? ' is-today' : ''}`}
              aria-pressed={active}
              onClick={() => setDayFilter(t.weekday)}
            >
              <span className="sch2-day-name">{t.isToday ? 'Today' : DAYS_FULL[t.weekday].slice(0, 3)}</span>
              <span className="sch2-day-num">{t.date}</span>
              <span className="sch2-day-count">{t.count} {t.count === 1 ? 'show' : 'shows'}</span>
            </button>
          );
        })}
      </nav>

      {/* Next up spotlight */}
      {!isLoading && spotlight && (
        <Link to={`/anime/${spotlight.id}`} className="sch2-spot">
          <img src={spotlight.cover_image || '/placeholder.svg'} alt="" aria-hidden className="sch2-spot-bg" />
          <img src={spotlight.cover_image || '/placeholder.svg'} alt={`${spotlight.title} poster`} className="sch2-spot-poster" />
          <div className="sch2-spot-body">
            <p className="sch2-eyebrow"><Flame aria-hidden /> Next to air</p>
            <h2 className="sch2-spot-title">{spotlight.title}</h2>
            <p className="sch2-spot-meta">
              Season {spotlight.season_number} · Episode {spotlight.next_episode}
              <span aria-hidden> · </span>
              {spotlight.is_daily ? 'Daily' : DAYS_FULL[spotlight.release_day]} at {formatTime(spotlight.release_hour, spotlight.release_minute)}
            </p>
            {spotlight.languages.length > 0 && (
              <div className="sch2-langs">
                {spotlight.languages.map((l) => <span key={l}>{l}</span>)}
              </div>
            )}
          </div>
          <CountdownBlocks target={spotlight.next} now={now} />
        </Link>
      )}

      {/* Ongoing releases */}
      <section aria-labelledby="sch2-ongoing" className="sch2-section">
        <div className="sch2-section-head">
          <h2 id="sch2-ongoing"><Tv aria-hidden /> Ongoing releases</h2>
          <span>{rows.length} series</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-[92px] w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="sch2-empty">
            <Tv aria-hidden />
            <h3>No releases scheduled</h3>
            <p>Try a different day or clear your search.</p>
          </div>
        ) : (
          groups.map((g) => {
            const label = groupLabel(g);
            return (
              <div key={g.key} className="sch2-group">
                <div className="sch2-group-head">
                  <h3>{label.title}</h3>
                  {label.sub && <span>{label.sub}</span>}
                  <i aria-hidden />
                  <em>{g.items.length}</em>
                </div>
                <ul className="sch2-list">
                  {g.items.map((anime) => {
                    const [clock, ampm] = formatTime(anime.release_hour, anime.release_minute).split(' ');
                    return (
                      <li key={anime.id}>
                        <Link to={`/anime/${anime.id}`} className="sch2-row">
                          <div className="sch2-time">
                            <span className="sch2-time-v">{clock}</span>
                            <span className="sch2-time-ap">{ampm}</span>
                          </div>
                          <img
                            src={anime.cover_image || '/placeholder.svg'}
                            alt={`${anime.title} poster`}
                            loading="lazy"
                            decoding="async"
                            className="sch2-thumb"
                          />
                          <div className="sch2-info">
                            <h4 className="sch2-title">{anime.title}</h4>
                            <div className="sch2-meta">
                              <span className="sch2-time-inline">{clock} {ampm}</span>
                              <span className="sch2-ep">S{anime.season_number} · EP {anime.next_episode}</span>
                              {anime.is_daily && <span className="sch2-tag">Daily</span>}
                              {anime.languages.length > 0 && <span className="sch2-lang">{anime.languages.join(' · ')}</span>}
                            </div>
                          </div>
                          <CountdownPill target={anime.next} now={now} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {/* Upcoming */}
      {upcomingRows.length > 0 && (
        <section aria-labelledby="sch2-upcoming" className="sch2-section">
          <div className="sch2-section-head">
            <h2 id="sch2-upcoming"><Sparkles aria-hidden /> Upcoming seasons</h2>
            <span>{upcomingRows.length} {upcomingRows.length === 1 ? 'title' : 'titles'}</span>
          </div>
          <div className="sch2-up-grid">
            {upcomingRows.map((u) => (
              <div key={u.id} className="sch2-up">
                <PosterCard
                  to={`/anime/${u.anime_id}`}
                  title={u.title}
                  cover={u.cover_image}
                  genres={u.genres}
                  isEngDub={u.is_eng_dub}
                  isSubOnly={u.is_sub_only}
                  tag={`S${u.season_number}`}
                  fluid
                />
                <div className="sch2-up-when">
                  {u.target ? (
                    <>
                      <span className="sch2-up-date">
                        {u.target.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone })}
                      </span>
                      <CountdownPill target={u.target} now={now} />
                    </>
                  ) : (
                    <span className="sch2-up-date is-tba">Date not announced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 text-center">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/browse">Browse all anime</Link>
        </Button>
      </div>
    </div>
  );
}
