import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, Clock, ChevronRight } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';

interface LatestEpisode {
  id: string;
  title: string;
  episode_number: number;
  thumbnail: string | null;
  created_at: string;
  duration: number | null;
  season: {
    season_number: number;
    anime: {
      id: string;
      title: string;
      cover_image: string | null;
      type: string | null;
    };
  };
}

export function LatestEpisodes() {
  const [episodes, setEpisodes] = useState<LatestEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestEpisodes();
  }, []);

  const fetchLatestEpisodes = async () => {
    try {
      // Fetch episodes ordered by created_at (most recent first)
      const { data, error } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          episode_number,
          thumbnail,
          created_at,
          duration,
          season:season_id (
            season_number,
            anime:anime_id (
              id,
              title,
              cover_image,
              type,
              updated_at
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) throw error;
      
      // Filter out episodes from movies - only show series episodes
      const filteredEpisodes = (data || []).filter((ep: any) => {
        return ep.season?.anime && ep.season.anime.type !== 'movie';
      });
      
      // Take only first 4 after filtering
      setEpisodes(filteredEpisodes.slice(0, 4) as unknown as LatestEpisode[]);
    } catch (error) {
      console.error('Error fetching latest episodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  if (loading) {
    return (
      <section className="py-10 md:py-14">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Episodes</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (episodes.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Episodes</h2>
            <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
              New
            </span>
          </div>
          <Button asChild variant="ghost" className="group">
            <Link to="/browse?type=series" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {episodes.map((episode, index) => (
            <AnimeCardContextMenu
              key={episode.id}
              animeTitle={episode.season?.anime?.title || episode.title}
              animeUrl={`/watch/${episode.id}`}
              coverImage={episode.thumbnail || episode.season?.anime?.cover_image}
            >
              <Link
                to={`/watch/${episode.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[200px] md:w-auto shrink-0`}
              >
                {/* Thumbnail with hover effects */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl transition-all duration-500">
                  <img
                    src={episode.thumbnail || episode.season?.anime?.cover_image || '/placeholder.svg'}
                    alt={episode.season?.anime?.title || episode.title}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-6 w-6 text-primary-foreground fill-current" />
                    </div>
                  </div>

                  {/* Season & Episode badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                    S{episode.season?.season_number} E{episode.episode_number}
                  </div>

                  {/* NEW badge */}
                  {isNew(episode.created_at) && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                      NEW
                    </div>
                  )}
                </div>

                {/* Anime Title only - simplified */}
                <h3 className="text-sm md:text-base font-semibold mt-3 line-clamp-2 group-hover:text-primary transition-colors duration-300">
                  {episode.season?.anime?.title}
                </h3>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
}
