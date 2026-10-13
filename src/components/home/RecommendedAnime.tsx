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

  return (
    <section className="py-12 relative overflow-hidden">
      {/* Layered backdrop accents */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute top-10 right-0 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="container relative">
        {/* Editorial header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-stretch gap-3.5 min-w-0">
            <div className="w-[3px] rounded-full bg-gradient-to-b from-purple-400 via-primary to-transparent shadow-[0_0_14px_hsl(var(--primary))]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Brain className="h-3 w-3" />
                  AI Curated
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <Flame className="h-2.5 w-2.5" />
                  v2.0
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-[2rem] font-heading font-bold leading-tight tracking-tight">
                Smart <span className="anime-gradient-text">Recommendations</span>
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground/90 mt-1 flex items-center gap-1.5">
                <ActiveMoodIcon className="h-3 w-3 text-primary" />
                <span>{activeMood.description}</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="group shrink-0 rounded-full border border-white/5 hover:border-primary/30 hover:bg-primary/10">
            <Link to="/browse" className="flex items-center gap-1">
              Explore all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        {/* Mood selector — segmented glass control */}
        <div className="relative mb-4 -mx-4 px-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none p-1 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 inline-flex w-full md:w-auto">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = mood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.8)] scale-[1.02]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                  aria-pressed={active}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? '' : 'opacity-70'}`} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Driver signal chips */}
        {driverChips.length > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none -mx-4 px-4">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
              {mood === 'auto' ? 'Tuned by' : 'Mood'}
            </span>
            <span className="shrink-0 text-muted-foreground/40">›</span>
            {driverChips.map((g) => (
              <span
                key={g}
                className="shrink-0 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-primary/8 text-foreground/90 border border-primary/20 backdrop-blur-sm hover:border-primary/40 transition-colors"
              >
                #{g}
              </span>
            ))}
            {mood === 'auto' && ratedTopGenres.length > 0 && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Compass className="h-2.5 w-2.5" />
                Ratings boost
              </span>
            )}
          </div>
        )}


        {/* Poster row */}
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {recommendations.map((anime, index) => (
            <AnimeCardContextMenu
              key={anime.id}
              animeTitle={anime.title || ''}
              animeUrl={`/anime/${anime.id}`}
              coverImage={anime.cover_image}
            >
              <Link
                to={`/anime/${anime.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[150px] md:w-[170px] lg:w-[190px] shrink-0`}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-primary/40">
                  {anime.cover_image && (
                    <img
                      src={anime.cover_image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ filter: 'blur(24px) brightness(0.4)' }}
                    />
                  )}
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title || ''}
                    className="relative z-[2] w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />

                  <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 z-[3] bg-gradient-to-tr from-primary/35 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {anime.status === 'ongoing' && (
                    <span className="absolute top-2 left-2 z-[5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-primary/90 text-primary-foreground shadow">
                      On Air
                    </span>
                  )}
                  {anime.status === 'upcoming' && (
                    <span className="absolute top-2 left-2 z-[5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-orange-500/90 text-white shadow flex items-center gap-1 animate-pulse">
                      <CalendarClock className="h-2.5 w-2.5" />
                      Soon
                    </span>
                  )}

                  <div className="absolute top-2 right-2 z-[5] flex flex-col gap-1 items-end pointer-events-none">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                      4K
                    </span>
                    <DubBadge isEngDub={(anime as any).is_eng_dub} isSubOnly={(anime as any).is_sub_only} genres={(anime as any).genres} />
                  </div>

                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-primary/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-5 w-5 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-[5] p-2.5 pointer-events-none">
                    <h3 className="text-[13px] md:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-white/75">
                      {anime.release_year && <span>{anime.release_year}</span>}
                      {anime.release_year && anime.genres?.[0] && <span className="opacity-50">•</span>}
                      {anime.genres?.[0] && (
                        <span className="text-primary-foreground/90 font-medium truncate">
                          {anime.genres[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
}
