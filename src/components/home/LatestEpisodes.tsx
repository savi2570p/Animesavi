import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, ChevronRight } from 'lucide-react';
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
      status: string | null;
    };
  };
}

interface GroupedEpisode {
  animeId: string;
  animeTitle: string;
  seasonNumber: number;
  coverImage: string | null;
  thumbnail: string | null;
  episodeMin: number;
  episodeMax: number;
  episodeCount: number;
  latestEpisodeId: string;
  latestCreatedAt: string;
  status: string | null;
}

export function LatestEpisodes() {
  const [episodes, setEpisodes] = useState<LatestEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestEpisodes();
  }, []);

  const fetchLatestEpisodes = async () => {
    try {
      // Fetch more episodes to allow for better grouping
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
              status,
              updated_at
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Filter out episodes from movies - only show series episodes
      const filteredEpisodes = (data || []).filter((ep: any) => {
        return ep.season?.anime && ep.season.anime.type !== 'movie';
      });
      
      setEpisodes(filteredEpisodes as unknown as LatestEpisode[]);
    } catch (error) {
      console.error('Error fetching latest episodes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group episodes by anime + season and merge into single entries
  const groupedEpisodes = useMemo<GroupedEpisode[]>(() => {
    const groups = new Map<string, GroupedEpisode>();
    
    for (const ep of episodes) {
      if (!ep.season?.anime) continue;
      
      const key = `${ep.season.anime.id}-${ep.season.season_number}`;
      const existing = groups.get(key);
      
      if (existing) {
        // Update min/max episode numbers
        existing.episodeMin = Math.min(existing.episodeMin, ep.episode_number);
        existing.episodeMax = Math.max(existing.episodeMax, ep.episode_number);
        existing.episodeCount++;
        
        // Keep the latest episode's data for the card
        if (new Date(ep.created_at) > new Date(existing.latestCreatedAt)) {
          existing.latestEpisodeId = ep.id;
          existing.latestCreatedAt = ep.created_at;
          existing.thumbnail = ep.thumbnail || existing.thumbnail;
        }
      } else {
        groups.set(key, {
          animeId: ep.season.anime.id,
          animeTitle: ep.season.anime.title,
          seasonNumber: ep.season.season_number,
          coverImage: ep.season.anime.cover_image,
          thumbnail: ep.thumbnail,
          episodeMin: ep.episode_number,
          episodeMax: ep.episode_number,
          episodeCount: 1,
          latestEpisodeId: ep.id,
          latestCreatedAt: ep.created_at,
          status: ep.season.anime.status,
        });
      }
    }
    
    // Convert to array and sort by latest created_at
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime())
      .slice(0, 8);
  }, [episodes]);

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  // Format episode range string
  const formatEpisodeRange = (min: number, max: number, count: number) => {
    if (min === max) {
      return `Episode ${min}`;
    }
    return `Episodes ${min}–${max}`;
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

  if (groupedEpisodes.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Latest Episodes</h2>
            {groupedEpisodes.some(g => isNew(g.latestCreatedAt)) && (
              <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
                New
              </span>
            )}
          </div>
          <Button asChild variant="ghost" className="group">
            <Link to="/browse?type=series" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {groupedEpisodes.slice(0, 4).map((group, index) => {
            const displayImage = group.thumbnail || group.coverImage || '/placeholder.svg';
            const episodeRangeText = formatEpisodeRange(group.episodeMin, group.episodeMax, group.episodeCount);
            const hasMultipleEpisodes = group.episodeMin !== group.episodeMax;
            
            return (
              <AnimeCardContextMenu
                key={`${group.animeId}-${group.seasonNumber}`}
                animeTitle={group.animeTitle}
                animeUrl={`/watch/${group.latestEpisodeId}`}
                coverImage={displayImage}
              >
                <Link
                  to={`/watch/${group.latestEpisodeId}`}
                  className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in w-[200px] md:w-auto shrink-0`}
                >
                  {/* Thumbnail with hover effects */}
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl transition-all duration-500">
                    <img
                      src={displayImage}
                      alt={group.animeTitle}
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

                    {/* Season badge */}
                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                      S{group.seasonNumber}
                    </div>

                    {/* Episode count badge for multiple episodes */}
                    {hasMultipleEpisodes && (
                      <div className="absolute top-2 left-14 px-2 py-1 text-xs font-bold bg-secondary text-secondary-foreground rounded-lg shadow-md">
                        +{group.episodeCount} eps
                      </div>
                    )}

                    {/* NEW badge */}
                    {isNew(group.latestCreatedAt) && (
                      <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                        NEW
                      </div>
                    )}

                    {/* Title and episode range overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                      <h3 className="text-sm font-semibold text-white line-clamp-1 drop-shadow-lg">
                        {group.animeTitle}
                      </h3>
                      <p className="text-xs text-white/70 mt-0.5">
                        {episodeRangeText}
                      </p>
                    </div>
                  </div>
                </Link>
              </AnimeCardContextMenu>
            );
          })}
        </div>
      </div>
    </section>
  );
}
