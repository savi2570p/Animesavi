import { useState, useEffect, useCallback } from 'react';
import { preloadImages } from '@/lib/imageOptimization';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Plus, Info, ChevronLeft, ChevronRight, Eye, Sparkles, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

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
  'Your Name': 9500000,
  'Your lie in April': 3400000,
  'The Angel Next Door Spoils me Rotten': 3600000,
  'The angel next door spoils me rotten': 3600000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  'Witch Hat atelier': 5400000,
  'Grand Blue Dreaming': 4800000,
  "A Gatherer's Adventure in Isekai": 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
  'attack on titan Muse India DUB': 9200000,
  'Attack on Titan Muse India DUB': 9200000,
  'attack on titan': 8900000,
  'Attack on Titan': 8900000,
  'Attack on Titan OAD': 2100000,
  'LIAR GAME': 7800000,
  'Liar Game': 7800000,
  'Dorohedoro': 6400000,
  'Easygoing Territory Defense by the Optimistic Lord': 5200000,
};

const getViewCount = (title: string, dbViewCount: number | null): number => {
  const mapKey = Object.keys(VIEW_COUNT_MAP).find(
    k => k.toLowerCase() === title.toLowerCase()
  );
  if (mapKey) return VIEW_COUNT_MAP[mapKey];
  if (dbViewCount && dbViewCount >= 1000) return dbViewCount;
  return Math.floor(Math.random() * (9000000 - 1000000) + 1000000);
};

export function FeaturedSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animKey, setAnimKey] = useState(0);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchFeaturedAnime = async () => {
      try {
        // Pull top viewed anime, then re-rank using the same Most Popular logic.
        const { data, error } = await supabase
          .from('anime')
          .select('id, title, description, cover_image, banner_image, genres, view_count, status')
          .order('view_count', { ascending: false })
          .limit(60);

        if (error) throw error;

        if (data && data.length > 0) {
          // Curated fixed hero lineup (stable order, not random) — sourced from "Most Popular".
          // Swaps requested: removed "Your Name" -> added "The Angel next door spoils me rotten".
          // Removed "Attack on Titan Muse India DUB" -> added "Witch Hat Atelier".
          const HERO_LINEUP = [
            'The Angel Next Door Spoils me Rotten',
            'Witch Hat Atelier',
            'Jujutsu Kaisen',
            'My Dress-Up Darling',
            'Solo Leveling',
            'Liar Game',
            'Dorohedoro',
            'Grand Blue Dreaming',
            'Easygoing Territory Defense by the Optimistic Lord',
            'Attack on Titan',
          ];

          const byTitle = (t: string) =>
            data.find(a => a.title?.toLowerCase() === t.toLowerCase()) ||
            data.find(a => a.title?.toLowerCase().includes(t.toLowerCase()));

          const matched: typeof data = [];
          const seen = new Set<string>();
          for (const t of HERO_LINEUP) {
            const f = byTitle(t);
            if (f && !seen.has(f.id)) { matched.push(f); seen.add(f.id); }
          }
          // Fill any missing slots from top-viewed fallback so we always show 10.
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
    setDirection(dir);
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

  // Auto-loop every 3 seconds — restarts on manual change
  useEffect(() => {
    if (featuredAnime.length === 0) return;
    const interval = setInterval(() => {
      setDirection('next');
      setCurrentIndex(prev => (prev + 1) % featuredAnime.length);
      setAnimKey(k => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentIndex, featuredAnime.length]);

  if (loading) {
    return (
      <section className="relative w-full">
        <div className="aspect-[16/9] md:aspect-[21/9] w-full">
          <Skeleton className="w-full h-full" />
        </div>
      </section>
    );
  }

  if (featuredAnime.length === 0) return null;

  const current = featuredAnime[currentIndex];
  const heroImage = current.banner || current.thumbnail;

  // ─── DESKTOP: Full-width cinematic hero ───
  if (!isMobile) {
    return (
      <section className="relative w-full overflow-x-hidden overflow-y-visible">
        {/* Background hero image */}
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          {featuredAnime.map((anime, idx) => (
            <div
              key={anime.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                key={idx === currentIndex ? `img-${animKey}` : `img-${idx}`}
                src={anime.banner || anime.thumbnail || '/placeholder.svg'}
                alt={anime.title}
                className={`w-full h-full object-cover ${idx === currentIndex ? (direction === 'next' ? 'hero-slide-in-right' : 'hero-slide-in-left') : ''}`}
              />
            </div>
          ))}

          {/* Gradient overlays */}
          <div className="absolute inset-0 z-20 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-transparent to-background/30" />

          {/* Content overlay */}
          <div className="absolute inset-0 z-30 flex items-center">
            <div className="container">
              <div key={`content-${animKey}`} className="hero-content-in max-w-2xl space-y-5">
                {/* Featured pill + slide counter */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary shadow-lg shadow-primary/10">
                    <Sparkles className="h-3 w-3" />
                    Featured · #{currentIndex + 1}
                  </div>
                  {current.status === 'ongoing' && (
                    <span className="badge-glass-og text-[10px] uppercase tracking-wider">OG</span>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-foreground/80 backdrop-blur-sm bg-background/20 rounded-full px-2.5 py-1 border border-border/30">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="font-semibold">{formatViews(current.views)}</span>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-heading font-extrabold leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                  <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                    {current.title}
                  </span>
                </h1>

                {/* Genres — chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {current.genres.slice(0, 4).map((genre, i) => (
                    <span
                      key={i}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full border border-foreground/15 bg-foreground/5 backdrop-blur-md text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-base text-foreground/75 line-clamp-3 max-w-lg leading-relaxed border-l-2 border-primary/50 pl-3">
                  {current.description || 'No description available.'}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button asChild size="lg" className="group bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground hover:scale-[1.03] text-base px-8 h-12 rounded-xl shadow-2xl shadow-primary/40 transition-all">
                    <Link to={`/anime/${current.id}`}>
                      <Play className="h-5 w-5 mr-2 fill-current group-hover:translate-x-0.5 transition-transform" />
                      Watch Now
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-foreground/20 bg-foreground/5 text-foreground hover:bg-foreground/15 hover:border-foreground/40 h-12 px-6 rounded-xl backdrop-blur-md transition-all">
                    <Link to={`/anime/${current.id}`}>
                      <Info className="h-5 w-5 mr-2" />
                      More Info
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation arrows — refined glassy */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-background/30 backdrop-blur-xl flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 hover:scale-110 transition-all border border-foreground/15 shadow-xl"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-background/30 backdrop-blur-xl flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 hover:scale-110 transition-all border border-foreground/15 shadow-xl"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Slim progress bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[280px] flex items-center gap-1">
          {featuredAnime.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx, idx > currentIndex ? 'next' : 'prev')}
              className={`h-[3px] rounded-full bg-foreground/20 overflow-hidden relative transition-all duration-500 ${idx === currentIndex ? 'flex-[2]' : 'flex-1'}`}
              aria-label={`Go to slide ${idx + 1}`}
            >
              <div
                key={idx === currentIndex ? `bar-${animKey}` : `bar-${idx}`}
                className={`absolute inset-y-0 left-0 rounded-full ${
                  idx === currentIndex
                    ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]'
                    : idx < currentIndex
                    ? 'bg-primary w-full'
                    : 'w-0'
                }`}
                style={idx === currentIndex ? { animation: 'slider-fill 3s linear forwards' } : idx < currentIndex ? { width: '100%' } : { width: '0%' }}
              />
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ─── MOBILE: Taller cinematic slider ───
  return (
    <section className="relative w-full overflow-x-hidden overflow-y-visible">
      <div className="relative w-full aspect-[16/9] overflow-hidden">
        {featuredAnime.map((anime, idx) => (
          <div
            key={anime.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              key={idx === currentIndex ? `mimg-${animKey}` : `mimg-${idx}`}
              src={anime.banner || anime.thumbnail || '/placeholder.svg'}
              alt={anime.title}
              className={`w-full h-full object-cover ${idx === currentIndex ? (direction === 'next' ? 'hero-slide-in-right' : 'hero-slide-in-left') : ''}`}
            />
          </div>
        ))}

        {/* Strong gradient overlays for readability */}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 z-20 bg-gradient-to-t from-background to-transparent" />

        {/* Content overlay — mobile */}
        <div className="absolute inset-0 z-30 flex items-end pb-12 px-3">
          <div key={`mcontent-${animKey}`} className="hero-content-in w-full space-y-2 max-w-full overflow-hidden">
            {/* Featured pill + views */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 backdrop-blur-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                #{currentIndex + 1}
              </div>
              {current.status === 'ongoing' && (
                <span className="badge-glass-og text-[8px] uppercase tracking-wider font-bold">OG</span>
              )}
              <div className="flex items-center gap-1 text-[10px] text-foreground/90 font-semibold backdrop-blur-sm bg-background/30 rounded-full px-1.5 py-0.5 border border-border/30">
                <Eye className="h-2.5 w-2.5" />
                {formatViews(current.views)}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-heading font-extrabold leading-tight line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
              {current.title}
            </h2>

            {/* Genres — chips */}
            <div className="flex flex-wrap items-center gap-1">
              {current.genres.slice(0, 3).map((genre, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-foreground/15 bg-foreground/10 backdrop-blur-md text-foreground/85"
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Description */}
            <p className="text-[12px] text-foreground/75 line-clamp-2 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] border-l-2 border-primary/50 pl-2">
              {current.description || 'No description available.'}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button asChild size="sm" className="bg-gradient-to-r from-primary to-primary/85 text-primary-foreground hover:bg-primary text-xs px-4 h-8 rounded-lg shadow-lg shadow-primary/40 font-semibold">
                <Link to={`/anime/${current.id}`}>
                  <Play className="h-3.5 w-3.5 mr-1 fill-current" />
                  Watch Now
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="border-foreground/20 bg-foreground/10 text-foreground hover:bg-foreground/20 h-8 px-3 rounded-lg backdrop-blur-md text-xs font-semibold">
                <Link to={`/anime/${current.id}`}>
                  <Info className="h-3.5 w-3.5 mr-1" />
                  Info
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center border border-foreground/15 shadow-lg"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center border border-foreground/15 shadow-lg"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Slim progress bar - iOS-hardened: kill default Safari button chrome
          that turns 2px-tall <button>s into giant rounded pills/circles. */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2"
        style={{
          width: 'min(200px, 70vw)',
          maxWidth: '70vw',
          WebkitTransform: 'translate3d(-50%, 0, 0)',
          transform: 'translate3d(-50%, 0, 0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {featuredAnime.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx, idx > currentIndex ? 'next' : 'prev')}
            className={`overflow-hidden relative transition-all duration-500 ${idx === currentIndex ? 'flex-[2]' : 'flex-1'}`}
            style={{
              // ── iOS Safari reset (no rounded mega-pills, no UA padding) ──
              WebkitAppearance: 'none',
              appearance: 'none',
              padding: 0,
              margin: 0,
              border: 0,
              outline: 'none',
              boxSizing: 'border-box',
              display: 'block',
              height: '2px',
              minHeight: '2px',
              maxHeight: '2px',
              borderRadius: '1px',
              background: 'hsl(0 0% 100% / 0.2)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={`Go to slide ${idx + 1}`}
          >
            <div
              key={idx === currentIndex ? `mbar-${animKey}` : `mbar-${idx}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                borderRadius: '1px',
                background:
                  idx === currentIndex || idx < currentIndex
                    ? 'hsl(var(--primary))'
                    : 'transparent',
                width:
                  idx < currentIndex ? '100%' : idx === currentIndex ? undefined : '0%',
                ...(idx === currentIndex
                  ? { animation: 'slider-fill 3s linear forwards' }
                  : {}),
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
