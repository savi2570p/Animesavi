import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { UpcomingCountdownDialog } from '@/components/home/UpcomingCountdownDialog';

interface UpcomingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  created_at: string;
  type: string | null;
}

export function ComingSoon() {
  const [animeList, setAnimeList] = useState<UpcomingAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnime, setSelectedAnime] = useState<UpcomingAnime | null>(null);

  useEffect(() => {
    fetchUpcomingAnime();
  }, []);

  const fetchUpcomingAnime = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, release_year, created_at, type')
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        console.error('Error fetching upcoming anime:', error);
        setIsLoading(false);
        return;
      }

      setAnimeList(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoading && animeList.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <CalendarClock className="h-6 w-6 text-orange-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-heading font-bold">Coming Soon</h2>
            <span className="px-2 py-1 text-xs font-medium bg-orange-500/20 text-orange-500 rounded-full">
              Upcoming
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/upcoming" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 w-[140px] md:w-auto shrink-0">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : (
            animeList.map((anime) => (
              <AnimeCardContextMenu 
                key={anime.id} 
                animeTitle={anime.title}
                animeUrl={`/anime/${anime.id}`}
                coverImage={anime.cover_image}
              >
                <Link
                  to={`/anime/${anime.id}`}
                  className="group relative w-[140px] md:w-auto shrink-0"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                    {anime.cover_image ? (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    
                    {/* Coming Soon Badge */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center px-3">
                        <CalendarClock className="h-6 w-6 text-orange-400 mx-auto mb-1" />
                        <span className="text-white text-xs font-medium leading-tight block">
                          Coming Soon
                        </span>
                      </div>
                    </div>

                    {/* Type badge */}
                    {anime.type && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">
                        {anime.type}
                      </div>
                    )}

                    {/* Release year badge */}
                    {anime.release_year && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-orange-500/90 text-[10px] font-bold text-white">
                        {anime.release_year}
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                </Link>
              </AnimeCardContextMenu>
            ))
          )}
        </div>
      </div>
    </section>
  );
}