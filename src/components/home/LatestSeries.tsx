import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tv, ChevronRight, Play } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';

interface AnimeSeries {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  episode_count: number;
}

export function LatestSeries() {
  const [series, setSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSeries();
  }, []);

  const fetchLatestSeries = async () => {
    try {
      // Fetch anime series with episode counts
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select(`
          id,
          title,
          cover_image,
          created_at,
          type
        `)
        .eq('type', 'series')
        .order('created_at', { ascending: false })
        .limit(4);

      if (animeError) throw animeError;

      // Fetch episode counts for each series
      const seriesWithCounts = await Promise.all(
        (animeData || []).map(async (anime) => {
          // Get seasons for this anime
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', anime.id);

          let episodeCount = 0;
          if (seasons && seasons.length > 0) {
            const seasonIds = seasons.map(s => s.id);
            const { count: epCount } = await supabase
              .from('episodes')
              .select('id', { count: 'exact', head: true })
              .in('season_id', seasonIds);
            episodeCount = epCount || 0;
          }

          return {
            ...anime,
            episode_count: episodeCount
          };
        })
      );

      setSeries(seriesWithCounts);
    } catch (error) {
      console.error('Error fetching latest series:', error);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= 7;
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tv className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Series</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (series.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Tv className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Series</h2>
            <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
              Series
            </span>
          </div>
          <Button asChild variant="ghost" className="group">
            <Link to="/browse?type=series" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {series.map((anime, index) => (
            <AnimeCardContextMenu
              key={anime.id}
              animeTitle={anime.title}
              animeUrl={`/anime/${anime.id}`}
              coverImage={anime.cover_image}
            >
              <Link
                to={`/anime/${anime.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 4)} animate-fade-in w-[140px] md:w-auto shrink-0`}
              >
                {/* Cover Image - Smaller */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted shadow-md group-hover:shadow-xl transition-all duration-500">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-all duration-300" />
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-6 w-6 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  {/* Episode count badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                    {anime.episode_count} EP{anime.episode_count !== 1 ? 'S' : ''}
                  </div>

                  {/* NEW badge */}
                  {isNew(anime.created_at) && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                      NEW
                    </div>
                  )}

                  {/* Title at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 drop-shadow-lg">
                      {anime.title}
                    </h3>
                    <p className="text-xs text-white/70 mt-1">
                      {anime.episode_count} Episode{anime.episode_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
}
