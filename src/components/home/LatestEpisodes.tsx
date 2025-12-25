import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, Clock, ChevronRight } from 'lucide-react';

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
              type
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {episodes.map((episode, index) => (
            <Link
              key={episode.id}
              to={`/watch/${episode.id}`}
              className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                <img
                  src={episode.thumbnail || episode.season?.anime?.cover_image || '/placeholder.svg'}
                  alt={episode.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <div className="p-3 rounded-full bg-primary/90">
                    <Play className="h-5 w-5 text-primary-foreground fill-current" />
                  </div>
                </div>

                {/* Duration badge */}
                {episode.duration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 text-xs font-medium bg-black/80 text-white rounded">
                    {formatDuration(episode.duration)}
                  </div>
                )}

                {/* Episode badge */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 text-xs font-bold bg-primary text-primary-foreground rounded">
                  EP {episode.episode_number}
                </div>

                {/* NEW badge for content uploaded in last 24 hours */}
                {isNew(episode.created_at) && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 text-xs font-bold bg-green-500 text-white rounded animate-pulse">
                    NEW
                  </div>
                )}
              </div>

              {/* Info */}
              <h3 className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                {episode.season?.anime?.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>S{episode.season?.season_number} E{episode.episode_number}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(episode.created_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
