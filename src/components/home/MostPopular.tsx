import { memo, useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Flame, ChevronRight, Play, Eye, Filter, Crown, TrendingUp, ArrowLeft, ArrowRight } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { getViewCount, formatViews } from '@/lib/viewCount';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PosterCard } from '@/components/anime/PosterCard';

interface PopularAnime {
  id: string;
  title: string;
  cover_image: string | null;
  view_count: number | null;
  status: string | null;
  genres: string[] | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
}

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller'
];

// Extra curated counts specific to this row, merged over the shared map.
const EXTRA_VIEW_COUNTS: Record<string, number> = {
  'Your Name': 9500000,
  'The Angel Next Door Spoils me Rotten': 3600000,
  "BOFURI: I Don't Want to Get Hurt, so I'll Max Out My Defense.": 2300000,
};

const resolveViews = (title: string, dbViews: number | null | undefined) => {
  const key = Object.keys(EXTRA_VIEW_COUNTS).find(k => k.toLowerCase() === (title || '').toLowerCase());
  if (key) return EXTRA_VIEW_COUNTS[key];
  return getViewCount(title, dbViews);
};

export const MostPopular = memo(function MostPopular() {
  const [animeList, setAnimeList] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => { fetchPopularAnime(); }, []);

  const filteredList = useMemo(() => {
    if (!selectedGenre) return animeList;
    return animeList.filter(a => a.genres?.some(g => g.toLowerCase() === selectedGenre.toLowerCase()));
  }, [selectedGenre, animeList]);

  const fetchPopularAnime = async () => {
    try {
      const COLS = 'id, title, cover_image, view_count, status, genres, is_eng_dub, is_sub_only';
      // Pull the all-time leaders AND the newest additions so freshly added
      // anime (which still have 0 DB views) can enter the popular row too.
      const [topRes, newRes] = await Promise.all([
        supabase.from('anime').select(COLS).order('view_count', { ascending: false }).limit(30),
        supabase.from('anime').select(COLS).order('created_at', { ascending: false }).limit(24),
      ]);
      if (topRes.error) throw topRes.error;

      const merged = new Map<string, PopularAnime>();
      [...(topRes.data || []), ...(newRes.data || [])].forEach((a: PopularAnime) => {
        if (!merged.has(a.id)) merged.set(a.id, a);
      });

      const animeWithViews = Array.from(merged.values()).map(a => ({
        ...a,
        view_count: resolveViews(a.title, a.view_count),
      }));
      animeWithViews.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      setAnimeList(animeWithViews);
    } catch (e) {
      console.error('Error fetching popular anime:', e);
    } finally {
      setLoading(false);
    }
  };

  const scrollRow = (direction: number) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  if (!loading && !animeList.length) return null;

  return (
    <section className="popular-section py-6 md:py-8">
      <div className="container">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-primary" />
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">All-time favourites</span>
              <h2 className="text-xl md:text-2xl font-heading font-bold">Most Popular</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 bg-card/60"><Filter className="h-3.5 w-3.5" />{selectedGenre || 'All Genres'}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto">
                <DropdownMenuItem onClick={() => setSelectedGenre(null)}>All Genres</DropdownMenuItem>
                {ALL_GENRES.map(g => <DropdownMenuItem key={g} onClick={() => setSelectedGenre(g)}>{g}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8" title="Previous titles" aria-label="Previous popular titles" onClick={() => scrollRow(-1)}><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8" title="Next titles" aria-label="Next popular titles" onClick={() => scrollRow(1)}><ArrowRight className="h-4 w-4" /></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/browse?sort=popular">See all<ChevronRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-hidden">{Array.from({length: 8}, (_, i) => <Skeleton key={i} className="w-[120px] lg:w-[144px] h-[220px] lg:h-[256px] shrink-0 rounded-md" />)}</div>
        ) : filteredList.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground"><p>No anime found for “{selectedGenre}”.</p><Button variant="link" onClick={() => setSelectedGenre(null)}>Clear filter</Button></div>
        ) : (
          <div ref={rowRef} className="snap-row flex gap-3 md:gap-4 overflow-x-auto -mx-3 px-3 pt-1 pb-4">
            {filteredList.slice(0, 14).map((anime, index) => (
              <AnimeCardContextMenu key={anime.id} animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
                <PosterCard to={`/anime/${anime.id}`} title={anime.title} cover={anime.cover_image} isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres}
                  tag={`#${String(index + 1).padStart(2, '0')}`} views={formatViews(anime.view_count || 0)} type={(anime as { type?: string | null }).type ?? null} status={(anime as { status?: string | null }).status ?? null} />
              </AnimeCardContextMenu>
            ))}
          </div>
        )}
      </div>
    </section>
  );
});
