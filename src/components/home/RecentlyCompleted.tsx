import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompletedAnime {
  id: string;
  title: string;
  cover_image: string | null;
  completed_at: string;
}

export function RecentlyCompleted() {
  const { user } = useAuth();
  const [completedAnime, setCompletedAnime] = useState<CompletedAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCompletedAnime();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchCompletedAnime = async () => {
    if (!user) return;

    // Fetch watch history where completed = true, get unique anime
    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        anime_id,
        watched_at,
        anime:anime_id (
          id,
          title,
          cover_image
        )
      `)
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('Error fetching completed anime:', error);
      setIsLoading(false);
      return;
    }

    // Get unique anime (most recent completion)
    const uniqueAnime = new Map<string, CompletedAnime>();
    data?.forEach((item) => {
      const anime = item.anime as any;
      if (anime && !uniqueAnime.has(anime.id)) {
        uniqueAnime.set(anime.id, {
          id: anime.id,
          title: anime.title,
          cover_image: anime.cover_image,
          completed_at: item.watched_at,
        });
      }
    });

    setCompletedAnime(Array.from(uniqueAnime.values()).slice(0, 8));
    setIsLoading(false);
  };

  // Don't show section if user is not logged in or no completed anime
  if (!user || (!isLoading && completedAnime.length === 0)) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h2 className="text-xl md:text-2xl font-heading font-bold">Recently Completed</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 w-[140px] md:w-auto shrink-0">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : (
            completedAnime.map((anime) => (
              <Link
                key={anime.id}
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
                  
                  {/* Completed Badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-green-500/90 text-white text-xs font-bold flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    COMPLETE
                  </div>

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {anime.title}
                </h3>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
