import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Plus, Info, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
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
  'The Angel Next Door Spoils me Rotten': 1200000,
  'The angel next door spoils me rotten': 1200000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  "BOFURI: I Don't Want to Get Hurt, so I'll Max Out My Defense.": 2300000,
  "A Gatherer's Adventure in Isekai": 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
};

const getViewCount = (title: string, dbViewCount: number | null): number => {
  if (VIEW_COUNT_MAP[title]) return VIEW_COUNT_MAP[title];
  if (dbViewCount && dbViewCount > 0) return dbViewCount;
  return Math.floor(Math.random() * (900000 - 100000) + 100000);
};

export function FeaturedSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchFeaturedAnime = async () => {
      try {
        const { data, error } = await supabase
          .from('anime')
          .select('id, title, description, cover_image, banner_image, genres, view_count, status')
          .order('view_count', { ascending: false })
          .limit(6);

        if (error) throw error;

        if (data && data.length > 0) {
          setFeaturedAnime(data.map(anime => ({
            id: anime.id,
            title: anime.title,
            description: anime.description,
            thumbnail: anime.cover_image,
            banner: anime.banner_image,
            genres: anime.genres || [],
            views: getViewCount(anime.title, anime.view_count),
            status: anime.status,
          })));
        }
      } catch (error) {
        console.error('Error fetching featured anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedAnime();
  }, []);

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (featuredAnime.length === 0) return;
    const interval = setInterval(() => handleNext(), 5000);
    return () => clearInterval(interval);
  }, [currentIndex, featuredAnime.length]);

  const handleNext = useCallback(() => {
    if (isAnimating || featuredAnime.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex(prev => (prev + 1) % featuredAnime.length);
    setTimeout(() => setIsAnimating(false), 600);
  }, [isAnimating, featuredAnime.length]);

  const handlePrev = useCallback(() => {
    if (isAnimating || featuredAnime.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex(prev => (prev - 1 + featuredAnime.length) % featuredAnime.length);
    setTimeout(() => setIsAnimating(false), 600);
  }, [isAnimating, featuredAnime.length]);

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
      <section className="relative w-full overflow-hidden">
        {/* Background hero image */}
        <div className="relative w-full aspect-[21/9] min-h-[480px] max-h-[680px]">
          {featuredAnime.map((anime, idx) => (
            <div
              key={anime.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={anime.banner || anime.thumbnail || '/placeholder.svg'}
                alt={anime.title}
                className="w-full h-full object-cover"
              />
            </div>
          ))}

          {/* Gradient overlays */}
          <div className="absolute inset-0 z-20 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-transparent to-background/30" />

          {/* Content overlay */}
          <div className="absolute inset-0 z-30 flex items-center">
            <div className="container">
              <div className="max-w-2xl space-y-5">
                {/* Status & views */}
                <div className="flex items-center gap-3">
                  {current.status === 'ongoing' && (
                    <Badge className="bg-primary text-primary-foreground text-xs uppercase tracking-wider px-3 py-1">
                      Ongoing
                    </Badge>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-foreground/80">
                    <Eye className="h-4 w-4" />
                    {formatViews(current.views)} views
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-heading font-extrabold leading-tight drop-shadow-lg">
                  {current.title}
                </h1>

                {/* Genres */}
                <div className="flex flex-wrap gap-2">
                  {current.genres.slice(0, 4).map((genre, i) => (
                    <span key={i} className="text-sm text-foreground/70 font-medium">
                      {i > 0 && <span className="mr-2">•</span>}
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-base text-foreground/70 line-clamp-3 max-w-lg leading-relaxed">
                  {current.description || 'No description available.'}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 h-12 rounded-lg shadow-lg shadow-primary/30">
                    <Link to={`/anime/${current.id}`}>
                      <Play className="h-5 w-5 mr-2 fill-current" />
                      Watch Now
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-foreground/30 text-foreground hover:bg-foreground/10 h-12 px-6 rounded-lg backdrop-blur-sm">
                    <Link to={`/anime/${current.id}`}>
                      <Info className="h-5 w-5 mr-2" />
                      More Info
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center hover:bg-background/60 transition-all border border-border/30"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center hover:bg-background/60 transition-all border border-border/30"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          {featuredAnime.map((_, idx) => (
            <button
              key={idx}
              onClick={() => { setCurrentIndex(idx); }}
              className={`h-1 rounded-full transition-all duration-500 ${
                idx === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-foreground/30 hover:bg-foreground/50'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>
    );
  }

  // ─── MOBILE: Compact poster-style slider ───
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background/50 py-6">
      <div className="container relative">
        {/* Navigation arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Slide content */}
        <div className="mx-8 overflow-hidden">
          <div className="flex flex-col items-center gap-4">
            {/* Poster */}
            <div className="relative flex-shrink-0 w-36">
              <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl ring-2 ring-primary/20">
                <img
                  src={current.thumbnail || '/placeholder.svg'}
                  alt={current.title}
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
                <TokenCrownBadge />
              </div>
            </div>

            {/* Info */}
            <div className="text-center space-y-3">
              <h2 className="text-xl font-bold line-clamp-2">{current.title}</h2>
              <div className="flex flex-wrap justify-center items-center gap-2">
                {current.genres.slice(0, 3).map((genre, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{genre}</Badge>
                ))}
                <div className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <Eye className="h-3 w-3" />
                  {formatViews(current.views)}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 max-w-sm mx-auto">
                {current.description || 'No description available.'}
              </p>
              <div className="flex justify-center gap-3 pt-1">
                <Button asChild size="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to={`/anime/${current.id}`}>
                    <Play className="h-4 w-4 mr-2 fill-current" />
                    Watch Now
                  </Link>
                </Button>
                <Button asChild variant="outline" size="default">
                  <Link to={`/anime/${current.id}`}>
                    <Info className="h-4 w-4 mr-2" />
                    More Info
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mx-8 mt-4">
          <div className="w-full h-[3px] bg-muted-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / featuredAnime.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
