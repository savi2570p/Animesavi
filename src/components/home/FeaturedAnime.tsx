import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Info, Star } from 'lucide-react';
import logo from '@/assets/logo.png';

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  genres: string[];
  status: string | null;
  view_count: number | null;
}

export function FeaturedAnime() {
  const [featured, setFeatured] = useState<Anime | null>(null);

  useEffect(() => {
    fetchFeatured();
  }, []);

  const fetchFeatured = async () => {
    // First try to get featured anime
    const { data } = await supabase
      .from('anime_public')
      .select('*')
      .eq('is_featured', true)
      .limit(1);

    if (data && data.length > 0) {
      setFeatured(data[0]);
    } else {
      // Fallback to most popular
      const { data: popularData } = await supabase
        .from('anime_public')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(1);

      if (popularData && popularData.length > 0) {
        setFeatured(popularData[0]);
      }
    }
  };

  if (!featured) return null;

  return (
    <section className="py-6 md:py-10">
      <div className="container">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <img 
            src={logo} 
            alt="Anime Savi" 
            className="h-10 w-10 md:h-12 md:w-12 rounded-xl object-contain shadow-lg" 
          />
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">
            <span className="text-primary">Anime</span>
            <span className="text-foreground ml-1">Savi</span>
          </h2>
        </div>

        {/* Featured Anime Card */}
        <div className="relative rounded-2xl overflow-hidden bg-card border border-border/50">
          <div className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
            {/* Poster/Thumbnail */}
            <div className="relative flex-shrink-0 w-full md:w-64">
              <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-xl">
                <img
                  src={featured.cover_image || '/placeholder.svg'}
                  alt={featured.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Status Badge */}
              {featured.status && (
                <Badge 
                  className="absolute top-3 left-3 capitalize"
                  variant={featured.status === 'completed' ? 'default' : 'secondary'}
                >
                  {featured.status}
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {/* Title */}
              <h1 className="text-2xl md:text-4xl font-bold line-clamp-2">
                {featured.title}
              </h1>

              {/* Genres */}
              {featured.genres && featured.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {featured.genres.slice(0, 4).map((genre, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Description */}
              {featured.description && (
                <p className="text-muted-foreground line-clamp-3 text-sm md:text-base">
                  {featured.description}
                </p>
              )}

              {/* View Count */}
              {featured.view_count && featured.view_count > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-primary" />
                  <span>{featured.view_count.toLocaleString()} views</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to={`/anime/${featured.id}`}>
                    <Play className="h-5 w-5 mr-2 fill-current" />
                    Watch Now
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to={`/anime/${featured.id}`}>
                    <Info className="h-5 w-5 mr-2" />
                    More Info
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Subtle Background Gradient */}
          <div 
            className="absolute inset-0 -z-10 opacity-20 blur-3xl"
            style={{
              background: `radial-gradient(circle at 30% 50%, hsl(var(--primary) / 0.3), transparent 60%)`
            }}
          />
        </div>
      </div>
    </section>
  );
}
