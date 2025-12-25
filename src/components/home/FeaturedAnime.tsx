import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  genres: string[];
  status: string | null;
}

export function FeaturedAnime() {
  const [featured, setFeatured] = useState<Anime[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Touch handling refs
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetchFeatured();
  }, []);

  // Auto-advance carousel every 6 seconds
  useEffect(() => {
    if (featured.length <= 1) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);

    return () => clearInterval(interval);
  }, [featured.length, currentIndex]);

  const fetchFeatured = async () => {
    // Use anime_public view to avoid exposing uploader_id
    const { data } = await supabase
      .from('anime_public')
      .select('*')
      .eq('is_featured', true)
      .limit(5);

    if (data && data.length > 0) {
      setFeatured(data);
    } else {
      const { data: popularData } = await supabase
        .from('anime_public')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(5);

      if (popularData) {
        setFeatured(popularData);
      }
    }
  };

  const changeSlide = useCallback((newIndex: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(newIndex);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const nextSlide = useCallback(() => {
    changeSlide((currentIndex + 1) % featured.length);
  }, [changeSlide, currentIndex, featured.length]);

  const prevSlide = useCallback(() => {
    changeSlide((currentIndex - 1 + featured.length) % featured.length);
  }, [changeSlide, currentIndex, featured.length]);

  // Touch handlers for mobile swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // Minimum swipe distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextSlide(); // Swipe left = next
      } else {
        prevSlide(); // Swipe right = previous
      }
    }
  }, [nextSlide, prevSlide]);

  if (featured.length === 0) return null;

  const current = featured[currentIndex];

  return (
    <section 
      ref={containerRef}
      className="relative h-[70vh] md:h-[85vh] overflow-hidden touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background with smooth transition - HD quality */}
      <div className="absolute inset-0">
        {featured.map((anime, index) => (
          <div
            key={anime.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={anime.banner_image || anime.cover_image || '/placeholder.svg'}
              alt={anime.title || 'Featured anime'}
              className="w-full h-full object-cover object-center"
              style={{
                imageRendering: 'auto',
              }}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />
          </div>
        ))}
      </div>
      
      {/* Overlays for readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-background/30" />

      {/* Content */}
      <div className="relative h-full container flex items-center">
        <div 
          key={current.id}
          className="max-w-2xl space-y-5 animate-fade-in"
        >
          {/* Genres */}
          <div className="flex flex-wrap gap-2">
            {current.genres?.slice(0, 4).map((genre, i) => (
              <Badge 
                key={genre} 
                className={`genre-badge stagger-${i + 1} opacity-0 animate-fade-in`}
              >
                {genre}
              </Badge>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight tracking-tight">
            {current.title}
          </h1>

          {/* Description */}
          {current.description && (
            <p className="text-base md:text-lg text-foreground/80 line-clamp-3 max-w-xl leading-relaxed">
              {current.description}
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex gap-3 pt-3">
            <Button asChild size="lg" className="anime-button text-base md:text-lg">
              <Link to={`/anime/${current.id}`}>
                <Play className="h-5 w-5 mr-2 fill-current" />
                Watch Now
              </Link>
            </Button>
            <Button 
              asChild 
              size="lg" 
              variant="outline" 
              className="text-base md:text-lg border-foreground/20 bg-background/40 backdrop-blur-sm hover:bg-background/60 transition-all duration-200"
            >
              <Link to={`/anime/${current.id}`}>
                <Info className="h-5 w-5 mr-2" />
                More Info
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {featured.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-background/30 backdrop-blur-sm hover:bg-background/50 transition-all duration-200 rounded-full"
            onClick={prevSlide}
            disabled={isTransitioning}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-background/30 backdrop-blur-sm hover:bg-background/50 transition-all duration-200 rounded-full"
            onClick={nextSlide}
            disabled={isTransitioning}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Progress Indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => changeSlide(i)}
                disabled={isTransitioning}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentIndex 
                    ? 'w-10 bg-primary' 
                    : 'w-2 bg-foreground/30 hover:bg-foreground/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
