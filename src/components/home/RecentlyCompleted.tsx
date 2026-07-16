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
  watched_at: string;
  is_eng_dub?: boolean | null;
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

    // Fetch all watch history for user, grouped by anime
    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        anime_id,
        episode_id,
        watched_at,
        completed,
        anime:anime_id (
          id,
          title,
          cover_image,
          is_eng_dub
        )
      `)
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('Error fetching watched anime:', error);
      setIsLoading(false);
      return;
    }

    // Group by anime and check if ALL episodes are completed
    const animeMap = new Map<string, {
      anime: any;
      completedEpisodes: Set<string>;
      latestWatch: string;
    }>();

    data?.forEach((item) => {
      const anime = item.anime as any;
      if (!anime) return;

      const existing = animeMap.get(anime.id);
      if (existing) {
        if (item.completed) {
          existing.completedEpisodes.add(item.episode_id);
        }
        if (new Date(item.watched_at) > new Date(existing.latestWatch)) {
          existing.latestWatch = item.watched_at;
        }
      } else {
        const completedSet = new Set<string>();
        if (item.completed) {
          completedSet.add(item.episode_id);
        }
        animeMap.set(anime.id, {
          anime,
          completedEpisodes: completedSet,
          latestWatch: item.watched_at,
        });
      }
    });

    // Get total episode counts for each anime and filter to only fully completed
    const result: CompletedAnime[] = [];
    
    for (const [animeId, data] of animeMap) {
      // Get total episodes for this anime
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('anime_id', animeId);

      let totalEpisodes = 0;
      if (seasons) {
        for (const season of seasons) {
          const { count } = await supabase
            .from('episodes')
            .select('id', { count: 'exact', head: true })
            .eq('season_id', season.id);
          totalEpisodes += count || 0;
        }
      }

      // Only include if ALL episodes are completed
      const allCompleted = totalEpisodes > 0 && data.completedEpisodes.size >= totalEpisodes;
      
      if (allCompleted) {
        result.push({
          id: data.anime.id,
          title: data.anime.title,
          cover_image: data.anime.cover_image,
          watched_at: data.latestWatch,
          is_eng_dub: data.anime.is_eng_dub ?? false,
        });
      }
    }

    // Sort by watch date (most recent first)
    result.sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());

    setCompletedAnime(result.slice(0, 8));
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
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/40 blur-xl rounded-full" />
              <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/80 font-semibold">Finished</p>
              <h2 className="text-xl md:text-2xl font-heading font-bold leading-tight">Recently Completed</h2>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 w-[140px] md:w-auto shrink-0">
                <Skeleton className="aspect-[2/3] rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : (
            completedAnime.map((anime) => (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                className="group relative w-[140px] md:w-[160px] lg:w-[180px] shrink-0"
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted ring-1 ring-white/5 shadow-lg shadow-black/40 transition-all duration-300 group-hover:ring-emerald-400/50 group-hover:shadow-emerald-500/20 group-hover:-translate-y-1">
                  {anime.cover_image ? (
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}

                  {/* Completed badge — liquid glass */}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-emerald-500/25 backdrop-blur-md border border-emerald-300/40 text-emerald-50 text-[10px] font-bold flex items-center gap-1 shadow-lg">
                    <CheckCircle className="h-3 w-3" />
                    DONE
                  </div>

                  {/* Dub badge */}
                  <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow backdrop-blur-md ${anime.is_eng_dub ? 'bg-emerald-500/90' : 'bg-amber-500/90'}`}>
                    {anime.is_eng_dub ? 'E-DUB' : 'H-DUB'}
                  </div>

                  {/* Bottom gradient overlay always subtle, intensifies on hover */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

                  {/* Title on hover */}
                  <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-300/90 font-semibold">Rewatch</span>
                  </div>
                </div>

                <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-emerald-300 transition-colors">
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
