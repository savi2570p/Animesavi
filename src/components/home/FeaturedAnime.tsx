import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchFeatured();
  }, []);

  const fetchFeatured = async () => {
    const { data } = await supabase
      .from('anime')
      .select('*')
      .eq('is_featured', true)
      .limit(5);

    if (data && data.length > 0) {
      setFeatured(data);
    } else {
      // Fallback to most viewed
      const { data: popularData } = await supabase
        .from('anime')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(5);

      if (popularData) {
        setFeatured(popularData);
      }
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % featured.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featured.length) % featured.length);
  };

  if (featured.length === 0) return null;

  const current = featured[currentIndex];

  return (
    <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-500"
        style={{
          backgroundImage: `url(${current.banner_image || current.cover_image || '/placeholder.svg'})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full container flex items-center">
        <div className="max-w-2xl space-y-6">
          <div className="flex flex-wrap gap-2">
            {current.genres?.slice(0, 3).map((genre) => (
              <Badge key={genre} variant="secondary" className="genre-badge">
                {genre}
              </Badge>
            ))}
          </div>

          <h1 className="text-4xl md:text-6xl font-heading font-bold leading-tight">
            {current.title}
          </h1>

          {current.description && (
            <p className="text-lg text-muted-foreground line-clamp-3 max-w-xl">
              {current.description}
            </p>
          )}

          <div className="flex gap-4 pt-4">
            <Button asChild size="lg" className="anime-button text-lg">
              <Link to={`/anime/${current.id}`}>
                <Play className="h-5 w-5 mr-2 fill-current" />
                Watch Now
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg border-border/50 bg-background/30 backdrop-blur-sm">
              <Link to={`/anime/${current.id}`}>
                <Info className="h-5 w-5 mr-2" />
                More Info
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {featured.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/30 backdrop-blur-sm hover:bg-background/50"
            onClick={prevSlide}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/30 backdrop-blur-sm hover:bg-background/50"
            onClick={nextSlide}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? 'w-8 bg-primary' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
