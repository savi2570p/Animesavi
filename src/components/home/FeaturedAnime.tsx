import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import logo from '@/assets/logo.png';

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
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }, [nextSlide, prevSlide]);

  if (featured.length === 0) return null;

  const current = featured[currentIndex];

  return (
    <section 
      ref={containerRef}
      className="relative h-[50vh] md:h-[65vh] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background with smooth transition */}
      <div className="absolute inset-0">
        {featured.map((anime, index) => (
          <div
            key={anime.id}
            className={`absolute inset-0 transition-all duration-700 ease-out ${
              index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
          >
            <img
              src={anime.banner_image || anime.cover_image || '/placeholder.svg'}
              alt={anime.title || 'Featured anime'}
              className="w-full h-full object-cover object-center"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />
          </div>
        ))}
      </div>
      
      {/* Overlays for readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full container flex items-center">
        <div 
          key={current.id}
          className="max-w-xl space-y-6"
        >
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="Anime.Savi.me" 
              className="h-12 w-12 rounded-xl object-contain shadow-lg" 
            />
            <h2 className="text-2xl md:text-3xl font-bold">
              <span className="text-primary">Anime</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-foreground">Savi</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-primary">me</span>
            </h2>
          </div>

          {/* CTA Button */}
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 shadow-lg">
            <Link to="/browse">
              Watch anime
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {featured.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50 backdrop-blur hover:bg-background/70 rounded-full"
            onClick={prevSlide}
            disabled={isTransitioning}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50 backdrop-blur hover:bg-background/70 rounded-full"
            onClick={nextSlide}
            disabled={isTransitioning}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Progress Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => changeSlide(i)}
                disabled={isTransitioning}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentIndex 
                    ? 'w-8 bg-primary' 
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
