import { memo, useState, useEffect, useCallback } from 'react';
import { useActiveOnScreen } from '@/hooks/usePerfTier';
import { preloadImages } from '@/lib/imageOptimization';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Pause, Info, ChevronLeft, ChevronRight, Eye, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface FeaturedAnimeItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  banner: string | null;
  genres: string[];
  views: number;
  status: string | null;
}

const formatViews = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  return `${(views / 1000).toFixed(0)}K`;
};

const VIEW_COUNT_MAP: Record<string, number> = {
  'Your lie in April': 3400000,
  'Hanaori-san Still Wants to Fight in the Next Life': 3600000,
  'The angel next door spoils me rotten': 3600000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  'Grand Blue Dreaming': 4800000,
  "A Gatherer's Adventure in Isekai": 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
  'attack on titan': 8900000,
  'Attack on Titan': 8900000,
  'Attack on Titan OAD': 2100000,
  'LIAR GAME': 7800000,
  'Liar Game': 7800000,
  'Easygoing Territory Defense by the Optimistic Lord': 5200000,
  "Tamon's B-side": 5100000,
  'Yowayowa Sensei': 4900000,
  'The Rising of the Shield Hero': 7100000,
  'Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs': 6800000,
  'Dr. stone': 6800000,
  'Chainsmoker cat': 5800000,
  'Smoking Behind the Supermarket with You': 5500000,
  'Re: Zero – Starting Life in Another World': 9200000,
  'Sparks of tomorrow': 4700000,
  'Clevatess': 5300000,
};

const getViewCount = (title: string, dbViewCount: number | null): number => {
  const mapKey = Object.keys(VIEW_COUNT_MAP).find(
    k => k.toLowerCase() === title.toLowerCase()
  );
  if (mapKey) return VIEW_COUNT_MAP[mapKey];
  if (dbViewCount && dbViewCount >= 1000) return dbViewCount;
  return Math.floor(Math.random() * (9000000 - 1000000) + 1000000);
};

export const FeaturedSlider = memo(function FeaturedSlider() {
  const [sliderRef, isActive] = useActiveOnScreen<HTMLElement>('100px');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedAnime = async () => {
      try {
        // 1) Try admin-curated lineup from featured_hero_lineup table.
        const { data: lineup } = await supabase
          .from('featured_hero_lineup')
          .select(`
            position, custom_title, custom_cover_url, custom_banner_url, is_active,
            anime:anime_id ( id, title, description, cover_image, banner_image, genres, view_count, status )
          `)
          .eq('is_active', true)
          .order('position', { ascending: true });

        if (lineup && lineup.length > 0) {
          const items = lineup
            .filter((row: any) => row.anime)
            .map((row: any) => ({
              id: row.anime.id,
              title: row.custom_title || row.anime.title,
              description: row.anime.description,
              thumbnail: row.custom_cover_url || row.anime.cover_image,
              banner: row.custom_banner_url || row.anime.banner_image,
              genres: row.anime.genres || [],
              views: getViewCount(row.anime.title, row.anime.view_count),
              status: row.anime.status,
            }));
          if (items.length > 0) {
            setFeaturedAnime(items);
            preloadImages(items.slice(0, 3).map(a => a.banner || a.thumbnail));
            return;
          }
        }

        // 2) Fallback: hard-coded curated lineup by title match.
        const { data, error } = await supabase
          .from('anime')
          .select('id, title, description, cover_image, banner_image, genres, view_count, status')
          .order('view_count', { ascending: false })
          .limit(60);

        if (error) throw error;

        if (data && data.length > 0) {
          const HERO_LINEUP = [
            'Hanaori-san Still Wants to Fight in the Next Life',
            'Smoking Behind the Supermarket with You',
            'Chainsmoker cat',
            'Yowayowa Sensei',
            'The Rising of the Shield Hero',
            'Clevatess',
            'Re: Zero – Starting Life in Another World',
            "Tamon's B-side",
            'Sparks of tomorrow',
            'Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs',
          ];

          const norm = (s: string) => s?.toLowerCase().replace(/[\s.]+/g, '') || '';
          const byTitle = (t: string) =>
            data.find(a => a.title?.toLowerCase() === t.toLowerCase()) ||
            data.find(a => a.title?.toLowerCase().includes(t.toLowerCase())) ||
            data.find(a => norm(a.title) === norm(t)) ||
            data.find(a => norm(a.title).includes(norm(t)));

          const matched: typeof data = [];
          const seen = new Set<string>();
          for (const t of HERO_LINEUP) {
            const f = byTitle(t);
            if (f && !seen.has(f.id)) { matched.push(f); seen.add(f.id); }
          }
          if (matched.length < 10) {
            const ranked = [...data].sort((a, b) =>
              getViewCount(b.title, b.view_count) - getViewCount(a.title, a.view_count)
            );
            for (const a of ranked) {
              if (matched.length >= 10) break;
              if (!seen.has(a.id)) { matched.push(a); seen.add(a.id); }
            }
          }

          const items = matched.slice(0, 10).map(anime => ({
            id: anime.id,
            title: anime.title,
            description: anime.description,
            thumbnail: anime.cover_image,
            banner: anime.banner_image,
            genres: anime.genres || [],
            views: getViewCount(anime.title, anime.view_count),
            status: anime.status,
          }));
          setFeaturedAnime(items);
          preloadImages(items.slice(0, 3).map(a => a.banner || a.thumbnail));
        }
      } catch (error) {
        console.error('Error fetching featured anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedAnime();
  }, []);



  const goTo = useCallback((nextIdx: number, dir: 'next' | 'prev') => {
    void dir;
    setCurrentIndex(nextIdx);
    setAnimKey(k => k + 1);
  }, []);

  const handleNext = useCallback(() => {
    if (featuredAnime.length === 0) return;
    goTo((currentIndex + 1) % featuredAnime.length, 'next');
  }, [currentIndex, featuredAnime.length, goTo]);

  const handlePrev = useCallback(() => {
    if (featuredAnime.length === 0) return;
    goTo((currentIndex - 1 + featuredAnime.length) % featuredAnime.length, 'prev');
  }, [currentIndex, featuredAnime.length, goTo]);

  // Auto-loop every 3 seconds — restarts on manual change.
  // Paused whenever the hero is off screen or the tab is backgrounded so we
  // never burn frames animating something nobody is looking at.
  useEffect(() => {
    if (featuredAnime.length < 2 || !isActive || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % featuredAnime.length);
      setAnimKey(k => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentIndex, featuredAnime.length, isActive, isPaused]);

  if (loading) return <section className="hero-v3"><Skeleton className="w-full h-full" /></section>;
  const current = featuredAnime[currentIndex];
  if (!current) return null;

  return (
    <section ref={sliderRef} className="hero-v3 relative isolate overflow-hidden" aria-label="Featured anime">
      <div className="hero-v3-media">
      {featuredAnime.map((anime, index) => (
        <img key={anime.id} src={anime.banner || anime.thumbnail || '/placeholder.svg'}
          alt={anime.title} width={1920} height={1080}
          loading={index < 2 ? 'eager' : 'lazy'} decoding="async"
          fetchPriority={index === 0 ? 'high' : 'auto'}
          className={`hero-v3-image absolute inset-0 w-full h-full object-cover ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <div className="hero-v3-scrim absolute inset-0 pointer-events-none" />
      </div>
      <div className="container relative flex flex-col justify-end h-full pb-5 md:pb-8 pt-8">
        <div key={animKey} className="hero-v3-copy max-w-2xl">
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="hero-v3-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-primary font-semibold"><Sparkles className="h-3 w-3" />Featured</span>
            <span className="inline-flex items-center gap-1.5 text-foreground/80"><Eye className="h-3.5 w-3.5" />{formatViews(current.views)} views</span>
            {current.status === 'ongoing' && <span className="badge-glass-og">OG</span>}
          </div>
          <h1 className="font-heading font-extrabold text-2xl md:text-4xl lg:text-5xl leading-tight text-foreground break-words line-clamp-3">{current.title}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] md:text-xs text-foreground/80">
            {current.genres.slice(0, 3).map(genre => <span key={genre}>{genre}</span>)}
          </div>
          <p className="hidden sm:block mt-3 max-w-lg text-sm text-foreground/75 leading-relaxed line-clamp-2">{current.description}</p>
          <div className="flex items-center gap-2 mt-5">
            <Button asChild className="h-9 md:h-11 rounded-lg px-5 gap-2"><Link to={`/anime/${current.id}`}><Play className="h-4 w-4 fill-current" />Watch Now</Link></Button>
            <Button asChild variant="outline" className="hero-v3-glass h-9 md:h-11 rounded-lg px-4 gap-2"><Link to={`/anime/${current.id}`}><Info className="h-4 w-4" />More Info</Link></Button>
          </div>
        </div>
        <div className="flex justify-between items-center gap-3 mt-6 md:mt-8">
          <div className="hero-v3-pagination flex items-center gap-1.5 min-w-0" aria-label="Featured slides">
            {featuredAnime.map((anime, index) => <Button key={anime.id} variant="ghost" size="icon"
              aria-label={`Go to slide ${index + 1}`} aria-current={index === currentIndex ? 'true' : undefined}
              onClick={() => goTo(index, index > currentIndex ? 'next' : 'prev')}
              className={`hero-v3-dot h-6 w-5 md:w-8 rounded-none ${index === currentIndex ? 'is-current' : ''}`}><span /></Button>)}
          </div>
          <div className="hero-v3-glass flex items-center rounded-full p-1 shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 rounded-full" onClick={handlePrev} aria-label="Previous featured anime"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 rounded-full" onClick={() => setIsPaused(value => !value)} aria-label={isPaused ? 'Resume featured slideshow' : 'Pause featured slideshow'}>{isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 rounded-full" onClick={handleNext} aria-label="Next featured anime"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </section>
  );
});
