import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WatchedAnime {
  id: string;
  title: string;
  cover_image: string | null;
  completed: boolean;
  progress: number;
  watched_at: string;
  total_episodes: number;
  watched_episodes: number;
}

export function RecentlyCompleted() {
  const { user } = useAuth();
  const [watchedAnime, setWatchedAnime] = useState<WatchedAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWatchedAnime();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchWatchedAnime = async () => {
    if (!user) return;

    // Fetch all watch history for user, grouped by anime
    const { data, error } = await supabase
      .from('watch_history')
      .select(`
        anime_id,
        episode_id,
        watched_at,
        completed,
        progress,
        anime:anime_id (
          id,
          title,
          cover_image
        )
      `)
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('Error fetching watched anime:', error);
      setIsLoading(false);
      return;
    }

    // Group by anime and calculate completion
    const animeMap = new Map<string, {
      anime: any;
      episodes: Set<string>;
      completedEpisodes: Set<string>;
      latestWatch: string;
      latestProgress: number;
    }>();

    data?.forEach((item) => {
      const anime = item.anime as any;
      if (!anime) return;

      const existing = animeMap.get(anime.id);
      if (existing) {
        existing.episodes.add(item.episode_id);
        if (item.completed) {
          existing.completedEpisodes.add(item.episode_id);
        }
        if (new Date(item.watched_at) > new Date(existing.latestWatch)) {
          existing.latestWatch = item.watched_at;
          existing.latestProgress = item.progress || 0;
        }
      } else {
        const completedSet = new Set<string>();
        if (item.completed) {
          completedSet.add(item.episode_id);
        }
        animeMap.set(anime.id, {
          anime,
          episodes: new Set([item.episode_id]),
          completedEpisodes: completedSet,
          latestWatch: item.watched_at,
          latestProgress: item.progress || 0,
        });
      }
    });

    // Get total episode counts for each anime
    const result: WatchedAnime[] = [];
    
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

      const allCompleted = totalEpisodes > 0 && data.completedEpisodes.size >= totalEpisodes;
      const overallProgress = totalEpisodes > 0 
        ? Math.round((data.completedEpisodes.size / totalEpisodes) * 100)
        : data.latestProgress;

      result.push({
        id: data.anime.id,
        title: data.anime.title,
        cover_image: data.anime.cover_image,
        completed: allCompleted,
        progress: overallProgress,
        watched_at: data.latestWatch,
        total_episodes: totalEpisodes,
        watched_episodes: data.completedEpisodes.size,
      });
    }

    // Sort: completed first, then by watch date
    result.sort((a, b) => {
      if (a.completed && !b.completed) return -1;
      if (!a.completed && b.completed) return 1;
      return new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime();
    });

    setWatchedAnime(result.slice(0, 8));
    setIsLoading(false);
  };

  // Don't show section if user is not logged in or no watched anime
  if (!user || (!isLoading && watchedAnime.length === 0)) {
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
            watchedAnime.map((anime) => (
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
                  
                  {/* Badge */}
                  {anime.completed ? (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-green-500/90 text-white text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      COMPLETE
                    </div>
                  ) : (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-primary/90 text-white text-xs font-bold flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {anime.progress}%
                    </div>
                  )}

                  {/* Progress bar for in-progress anime */}
                  {!anime.completed && anime.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(anime.progress, 100)}%` }}
                      />
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {anime.title}
                </h3>
                
                {/* Episode progress text */}
                {!anime.completed && anime.total_episodes > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {anime.watched_episodes}/{anime.total_episodes} episodes
                  </p>
                )}
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
