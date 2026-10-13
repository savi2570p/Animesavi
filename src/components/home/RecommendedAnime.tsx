import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Play, ChevronRight, CalendarClock, Heart, Flame,
  Brain, Smile, Swords, Ghost, Coffee, Compass, Wand2, Zap as ZapIcon,
} from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[];
  status: string | null;
  view_count: number | null;
  release_year: number | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
}

type MoodId = 'auto' | 'chill' | 'thrill' | 'feels' | 'epic' | 'funny' | 'dark' | 'wholesome';

interface Mood {
  id: MoodId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  genres: string[];
  description: string;
}

const MOODS: Mood[] = [
  { id: 'auto',      label: 'For You',  icon: Sparkles, genres: [],                                          description: 'Tuned by your watch history & ratings' },
  { id: 'thrill',    label: 'Thrill',   icon: ZapIcon,  genres: ['Action', 'Thriller', 'Mystery', 'Sci-Fi'], description: 'High-octane action & suspense' },
  { id: 'feels',     label: 'Feels',    icon: Heart,    genres: ['Romance', 'Drama', 'Slice of Life'],       description: 'Stories that hit the heart' },
  { id: 'epic',      label: 'Epic',     icon: Swords,   genres: ['Action', 'Adventure', 'Fantasy', 'Shounen'], description: 'Grand battles, hero arcs' },
  { id: 'funny',     label: 'Funny',    icon: Smile,    genres: ['Comedy', 'Slice of Life', 'School'],       description: 'Pure laughs & easy watches' },
  { id: 'chill',     label: 'Chill',    icon: Coffee,   genres: ['Slice of Life', 'Iyashikei', 'Romance'],   description: 'Cozy, low-stakes vibes' },
  { id: 'dark',      label: 'Dark',     icon: Ghost,    genres: ['Horror', 'Psychological', 'Thriller', 'Seinen'], description: 'Edge-of-seat, twisted plots' },
  { id: 'wholesome', label: 'Wholesome',icon: Wand2,    genres: ['Slice of Life', 'Family', 'Fantasy'],      description: 'Heart-warming family-safe picks' },
];

export function RecommendedAnime() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [ratedTopGenres, setRatedTopGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mood, setMood] = useState<MoodId>('auto');

  // Recompute when user or mood changes — true mood-aware behavior.
  useEffect(() => {
    if (user) fetchSmart();
    else fetchPopular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mood]);

  const moodGenres = useMemo(() => MOODS.find((m) => m.id === mood)?.genres ?? [], [mood]);

  const enrichWithDub = async (list: Anime[]): Promise<Anime[]> => {
    if (!list.length) return list;
    try {
      const ids = list.map((a) => a.id);
      const { data } = await supabase.from('anime').select('id, is_eng_dub, is_sub_only').in('id', ids);
      const map = new Map((data ?? []).map((r: any) => [r.id, { eng: !!r.is_eng_dub, sub: !!r.is_sub_only }]));
      return list.map((a) => ({ ...a, is_eng_dub: map.get(a.id)?.eng ?? false, is_sub_only: map.get(a.id)?.sub ?? false }));
    } catch {
      return list;
    }
  };

  const fetchSmart = async () => {
    setIsLoading(true);

    // 1) Watch-history-derived genre weights (existing trigger-fed table).
    const { data: prefs } = await supabase
      .from('user_genre_preferences')
      .select('genre, watch_count')
      .eq('user_id', user!.id)
      .order('watch_count', { ascending: false })
      .limit(5);

    // 2) Ratings-derived genre signal: anime the user rated 4-5 stars.
    let ratedGenres: string[] = [];
    try {
      const { data: highRatings } = await supabase
        .from('anime_reviews')
        .select('anime_id, rating')
        .eq('user_id', user!.id)
        .gte('rating', 4)
        .limit(20);
      const ratedAnimeIds = (highRatings ?? []).map((r) => r.anime_id);
      if (ratedAnimeIds.length > 0) {
        const { data: ratedAnime } = await supabase
          .from('anime_public')
          .select('genres')
          .in('id', ratedAnimeIds);
        const tally = new Map<string, number>();
        (ratedAnime ?? []).forEach((a) => {
          (a.genres ?? []).forEach((g: string) => tally.set(g, (tally.get(g) ?? 0) + 1));
        });
        ratedGenres = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);
      }
    } catch (e) {
      // anime_reviews/RLS quirks shouldn't break the row
      console.warn('[SmartRecs] ratings signal skipped', e);
    }

    setRatedTopGenres(ratedGenres);

    const watchGenres = (prefs ?? []).map((p) => p.genre);
    setTopGenres(watchGenres);

    // 3) Resolve effective genre set based on mood selection.
    //    - "auto"  → blend watch + rating signals
    //    - others  → take mood genres ∩ user signals if any overlap, else mood genres
    let effectiveGenres: string[];
    if (mood === 'auto') {
      effectiveGenres = Array.from(new Set([...watchGenres, ...ratedGenres])).slice(0, 5);
      if (effectiveGenres.length === 0) {
        await fetchPopular();
        return;
      }
    } else {
      const userSet = new Set([...watchGenres, ...ratedGenres]);
      const overlap = moodGenres.filter((g) => userSet.has(g));
      effectiveGenres = overlap.length > 0 ? overlap : moodGenres;
    }

    // 4) Exclude already-watched titles so picks feel fresh.
    const { data: watchedData } = await supabase
      .from('watch_history')
      .select('anime_id')
      .eq('user_id', user!.id);
    const watchedIds = watchedData?.map((w) => w.anime_id) ?? [];

    let query = supabase
      .from('anime_public')
      .select('*')
      .overlaps('genres', effectiveGenres)
      .order('view_count', { ascending: false })
      .limit(18);

    if (watchedIds.length > 0) {
      query = query.not('id', 'in', `(${watchedIds.join(',')})`);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      // Light shuffle so it doesn't look identical session-to-session.
      const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 14);
      setRecommendations(await enrichWithDub(shuffled));
    } else {
      // Mood with no matches → fall back to popular instead of empty state.
      const { data: pop } = await supabase
        .from('anime_public')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(14);
      setRecommendations(await enrichWithDub((pop ?? []).sort(() => Math.random() - 0.5)));
    }

    setIsLoading(false);
  };

  const fetchPopular = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('anime_public')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(14);
    if (data) {
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setRecommendations(await enrichWithDub(shuffled));
    }
    setIsLoading(false);
  };

  const activeMood = MOODS.find((m) => m.id === mood)!;
  const ActiveMoodIcon = activeMood.icon;

  if (isLoading && recommendations.length === 0) {
    return (
      <section className="py-12 relative">
        <div className="container">
          <div className="h-10 w-72 bg-muted/50 animate-pulse rounded-lg mb-6" />
          <div className="flex gap-3 overflow-hidden">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-[150px] md:w-[170px] shrink-0 aspect-[2/3] bg-muted/50 animate-pulse rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  // Signal chips show what's actually driving the picks.
  const driverChips = mood === 'auto'
    ? Array.from(new Set([...topGenres, ...ratedTopGenres])).slice(0, 4)
    : moodGenres.slice(0, 4);

  const [hero, ...rest] = recommendations;
  return (
    <section className="py-10 md:py-14 relative">
      <div className="container relative">
        <div className="lg-panel relative overflow-hidden rounded-3xl p-4 md:p-7">
          <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-primary/25 blur-[90px] animate-pulse" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-accent/20 blur-[90px]" />

          {/* Header */}
          <div className="relative flex items-end justify-between gap-4 flex-wrap mb-5">
            <div>
              <span className="lg-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3 w-3" /> Picked for you
              </span>
              <h2 className="mt-2 text-2xl md:text-4xl font-heading font-bold tracking-tight">
                Smart <span className="anime-gradient-text">Recommendations</span>
              </h2>
              <p key={mood} className="mt-1 text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 animate-fade-in">
                <ActiveMoodIcon className="h-3.5 w-3.5 text-primary" /> {activeMood.description}
              </p>
            </div>
            <Link to="/browse" className="lg-chip group inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold hover:text-primary">
              Explore all <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mood pills */}
          <div className="relative flex gap-2 overflow-x-auto snap-row pb-2 mb-4">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = mood === m.id;
              return (
                <button key={m.id} onClick={() => setMood(m.id)} aria-pressed={active}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                    active ? 'bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.8)] scale-105' : 'lg-chip text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
          {driverChips.length > 0 && (
            <div className="relative flex gap-1.5 overflow-x-auto snap-row mb-5">
              {driverChips.map((g) => (
                <span key={g} className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] text-foreground/90">#{g}</span>
              ))}
              {mood === 'auto' && ratedTopGenres.length > 0 && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-primary/25 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                  <Compass className="h-2.5 w-2.5" /> Ratings boost
                </span>
              )}
            </div>
          )}

          <div key={mood} className="relative flex gap-3 md:gap-4 overflow-x-auto snap-row pb-3">
            {/* Spotlight card */}
            {hero && (
              <Link to={`/anime/${hero.id}`}
                className="group relative shrink-0 w-[280px] md:w-[420px] aspect-[16/10] md:aspect-auto rounded-2xl overflow-hidden ring-1 ring-border animate-fade-in">
                <img src={hero.cover_image || '/placeholder.svg'} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
                <div className="relative flex h-full gap-4 p-4">
                  <img src={hero.cover_image || '/placeholder.svg'} alt={hero.title}
                    className="h-full max-h-[220px] aspect-[2/3] rounded-xl object-cover shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1" />
                  <div className="flex min-w-0 flex-col justify-end">
                    <div className="mb-2 flex flex-wrap gap-1"><DubBadge isEngDub={hero.is_eng_dub} isSubOnly={hero.is_sub_only} genres={hero.genres} /></div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">#1 Match</span>
                    <h3 className="mt-1 text-base md:text-xl font-bold leading-tight line-clamp-3">{hero.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{[hero.release_year, ...(hero.genres || []).slice(0, 2)].filter(Boolean).join(' · ')}</p>
                    <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform group-hover:scale-105">
                      <Play className="h-3.5 w-3.5 fill-current" /> Watch
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {rest.map((anime, index) => (
              <AnimeCardContextMenu key={anime.id} animeTitle={anime.title || ''} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
                <Link to={`/anime/${anime.id}`}
                  style={{ animationDelay: `${Math.min(index, 10) * 50}ms`, animationFillMode: 'both' }}
                  className="group relative block w-[140px] md:w-[165px] shrink-0 animate-fade-in">
                  <div className="lg-panel relative aspect-[2/3] overflow-hidden rounded-2xl transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_40px_-12px_hsl(var(--primary)/0.55)]">
                    {anime.cover_image && (
                      <img src={anime.cover_image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover blur-xl opacity-50 pointer-events-none" />
                    )}
                    <img src={anime.cover_image || '/placeholder.svg'} alt={anime.title || ''} loading="lazy"
                      className="relative z-[2] h-full w-full object-contain transition-transform duration-700 group-hover:scale-105 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 z-[3] h-1/2 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                    {anime.status === 'ongoing' && (
                      <span className="absolute top-2 left-2 z-[5] rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">On Air</span>
                    )}
                    {anime.status === 'upcoming' && (
                      <span className="absolute top-2 left-2 z-[5] inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        <CalendarClock className="h-2.5 w-2.5" /> Soon
                      </span>
                    )}
                    <div className="absolute top-2 right-2 z-[5] flex flex-col items-end gap-1 pointer-events-none">
                      <DubBadge isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres} />
                    </div>
                    <div className="pointer-events-none"><TokenCrownBadge /></div>
                    <div className="absolute inset-0 z-[4] grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
                      <span className="rounded-full bg-primary p-3 shadow-2xl scale-75 transition-transform duration-300 group-hover:scale-100">
                        <Play className="h-5 w-5 fill-current text-primary-foreground" />
                      </span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 z-[5] p-2.5 pointer-events-none">
                      <h3 className="text-[13px] font-semibold leading-tight line-clamp-2">{anime.title}</h3>
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{[anime.release_year, anime.genres?.[0]].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </Link>
              </AnimeCardContextMenu>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
