import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Info, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { TrailerPreview } from '@/components/home/TrailerPreview';

interface FeaturedAnimeItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  genres: string[];
  views: number;
}

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  return `${(views / 1000).toFixed(0)}K`;
};

// Curated view counts for specific anime (matching Most Popular section)
const VIEW_COUNT_MAP: Record<string, number> = {
  'Your Name': 9500000,
  'Your lie in April': 3400000,
  'The Angel Next Door Spoils me Rotten': 1200000,
  'The angel next door spoils me rotten': 1200000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  'BOFURI: I Don\'t Want to Get Hurt, so I\'ll Max Out My Defense.': 2300000,
  'A Gatherer\'s Adventure in Isekai': 267000,
  'Jujutsu Kaisen': 8700000,
  'My Dress-Up Darling': 6200000,
  'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
};

// Generate random views between 100K and 900K for unlisted anime
const getViewCount = (title: string, dbViewCount: number | null): number => {
  if (VIEW_COUNT_MAP[title]) {
    return VIEW_COUNT_MAP[title];
  }
  if (dbViewCount && dbViewCount > 0) {
    return dbViewCount;
  }
  return Math.floor(Math.random() * (900000 - 100000) + 100000);
};

export function FeaturedSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch featured anime from database
  useEffect(() => {
    const fetchFeaturedAnime = async () => {
      try {
        const { data, error } = await supabase
          .from('anime')
          .select('id, title, description, cover_image, genres, view_count')
          .order('view_count', { ascending: false })
          .limit(6);

        if (error) throw error;

        if (data && data.length > 0) {
          const animeWithViews = data.map(anime => ({
            id: anime.id,
            title: anime.title,
            description: anime.description,
            thumbnail: anime.cover_image,
            genres: anime.genres || [],
            views: getViewCount(anime.title, anime.view_count)
          }));
          setFeaturedAnime(animeWithViews);
        }
      } catch (error) {
        console.error('Error fetching featured anime:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedAnime();
  }, []);

  // Auto-slide every 4 seconds (pause when trailer is showing)
  useEffect(() => {
    if (featuredAnime.length === 0 || showTrailer) return;
    const interval = setInterval(() => {
      handleNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentIndex, featuredAnime.length, showTrailer]);

  const handleThumbnailMouseEnter = () => {
    const timeout = setTimeout(() => {
      setShowTrailer(true);
    }, 800);
    setHoverTimeout(timeout);
  };

  const handleThumbnailMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setShowTrailer(false);
  };

  const handleNext = () => {
    if (isAnimating || featuredAnime.length === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredAnime.length);
      setIsAnimating(false);
    }, 400);
  };

  const handlePrev = () => {
    if (isAnimating || featuredAnime.length === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + featuredAnime.length) % featuredAnime.length);
      setIsAnimating(false);
    }, 400);
  };

  if (loading) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background/50 py-6 md:py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center mx-8 md:mx-12">
            <Skeleton className="w-40 md:w-52 aspect-[3/4] rounded-xl" />
            <div className="flex-1 space-y-4 w-full">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (featuredAnime.length === 0) return null;

  const current = featuredAnime[currentIndex];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background/50 py-6 md:py-8">
      <div className="container relative">
        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Slide Content */}
        <div className="relative mx-8 md:mx-12 overflow-hidden">
          <div
            className={`flex flex-col md:flex-row gap-4 md:gap-6 items-center transition-transform duration-400 ease-out ${
              isAnimating ? '-translate-x-full' : 'translate-x-0'
            }`}
          >
            {/* Thumbnail with Trailer Preview on Hover */}
            <div 
              className="relative flex-shrink-0 w-40 md:w-52"
              onMouseEnter={handleThumbnailMouseEnter}
              onMouseLeave={handleThumbnailMouseLeave}
            >
              <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl ring-2 ring-primary/20">
                {showTrailer ? (
                  <TrailerPreview
                    animeId={current.id}
                    coverImage={current.thumbnail}
                    title={current.title}
                    onClose={() => setShowTrailer(false)}
                  />
                ) : (
                  <img
                    src={current.thumbnail || '/placeholder.svg'}
                    alt={current.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4">
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold line-clamp-2">
                {current.title}
              </h2>

              {/* Genres and Views */}
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
                {current.genres.slice(0, 3).map((genre, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
                <div className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <Eye className="h-3 w-3" />
                  {formatViews(current.views)} views
                </div>
              </div>

              {/* Description */}
              <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-3 max-w-xl">
                {current.description || 'No description available.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
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

        {/* Progress Bar Indicator */}
        <div className="mx-8 md:mx-12 mt-4">
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
