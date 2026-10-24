import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Play, ChevronRight, CalendarClock, Heart, Flame,
  Smile, Swords, Ghost, Coffee, Compass, Wand2, Zap as ZapIcon,
} from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';
import { CatalogueHeading } from './CatalogueHeading';
import { optimizedImageUrl, fhdFallback } from '@/lib/imageOptimization';

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
  const rowRef = useRef<HTMLDivElement>(null);
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
    if (!user) return;
    setIsLoading(true);

    // 1) Watch-history-derived genre weights (existing trigger-fed table).
    const { data: prefs } = await supabase
      .from('user_genre_preferences')
      .select('genre, watch_count')
      .eq('user_id', user.id)
      .order('watch_count', { ascending: false })
      .limit(5);

    // 2) Ratings-derived genre signal: anime the user rated 4-5 stars.
    let ratedGenres: string[] = [];
    try {
      const { data: highRatings } = await supabase
        .from('anime_reviews')
        .select('anime_id, rating')
        .eq('user_id', user.id)
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
      .eq('user_id', user.id);
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

  if (!isLoading && recommendations.length === 0) return null;

  const driverChips = mood === 'auto'
    ? Array.from(new Set([...topGenres, ...ratedTopGenres])).slice(0, 4)
    : moodGenres.slice(0, 4);

  return (
    <section className="catalogue-section recommendations-v11 py-6 md:py-9" aria-label="Smart Recommendations">
      <div className="container">
        <CatalogueHeading title="Smart Recommendations" eyebrow="Picked for you" icon={Sparkles} href="/browse" rowRef={rowRef} />
        <div className="recommendations-v11-tools">
          <div className="flex gap-1.5 overflow-x-auto snap-row py-1" role="group" aria-label="Recommendation mood">
            {MOODS.map(({ id, label, icon: Icon }) => (
              <Button key={id} variant={mood === id ? 'secondary' : 'glass'} size="sm" aria-pressed={mood === id}
                onClick={() => setMood(id)} className="shrink-0 rounded-md text-xs gap-1.5">
                <Icon className="h-3.5 w-3.5" />{label}
              </Button>
            ))}
          </div>
          {!!driverChips.length && <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground py-2">
            {driverChips.map(genre => <span key={genre}>{genre}</span>)}
          </div>}
        </div>
        <div ref={rowRef} className="flex gap-3 overflow-x-auto snap-row pb-3 pt-2" aria-busy={isLoading}>
          {isLoading && !recommendations.length ? Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="recommendations-v11-card h-[242px] rounded-lg bg-muted motion-safe:animate-pulse shrink-0" />
          )) : recommendations.map(anime => {
            const image = anime.cover_image || '/placeholder.svg';
            return <AnimeCardContextMenu key={anime.id} animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
              <Link to={`/anime/${anime.id}`} className="recommendations-v11-card catalogue-glass group block rounded-lg overflow-hidden">
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  <img src={optimizedImageUrl(image, { width: 320, quality: 75 })} alt="" aria-hidden loading="lazy" className="catalogue-fill perf-blur-fill absolute inset-0 w-full h-full object-cover" />
                  <img src={optimizedImageUrl(image, { width: 320, quality: 85 })} onError={fhdFallback(image)} alt={anime.title} loading="lazy" decoding="async" className="relative w-full h-full object-contain" />
                  <div className="catalogue-image-scrim absolute inset-0 pointer-events-none" />
                  <div className="absolute inset-x-1.5 bottom-2 flex flex-wrap gap-1"><DubBadge isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres} /></div>
                  <TokenCrownBadge />
                  <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary-foreground fill-current opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
                <div className="p-2 space-y-1">
                  <h3 className="text-xs leading-4 font-semibold line-clamp-2 h-8">{anime.title}</h3>
                  <p className="text-[10px] text-muted-foreground truncate">{[anime.release_year, anime.genres?.[0]].filter(Boolean).join(' · ')}</p>
                </div>
              </Link>
            </AnimeCardContextMenu>;
          })}
        </div>
      </div>
    </section>
  );
}
