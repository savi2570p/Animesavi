import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Play, ArrowLeft } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';

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

export default function LatestEpisodesPage() {
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
              type,
              status,
              updated_at
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
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

  const groupedEpisodes = useMemo<GroupedEpisode[]>(() => {
    const groups = new Map<string, GroupedEpisode>();
    
    for (const ep of episodes) {
      if (!ep.season?.anime) continue;
      
      const key = `${ep.season.anime.id}-${ep.season.season_number}`;
      const existing = groups.get(key);
      
      if (existing) {
        existing.episodeMin = Math.min(existing.episodeMin, ep.episode_number);
        existing.episodeMax = Math.max(existing.episodeMax, ep.episode_number);
        existing.episodeCount++;
        
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
    
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
  }, [episodes]);

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  const formatEpisodeRange = (min: number, max: number) => {
    if (min === max) {
      return `Episode ${min}`;
    }
    return `Episodes ${min}–${max}`;
  };

  return (
    <div className="min-h-screen">
      {/* Content Navigation Tabs */}
      <ContentNavTabs />
      
      {/* Hero Header */}
      <div className="relative overflow-x-hidden overflow-y-visible px-4 py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold">Latest Episodes</h1>
              <p className="text-muted-foreground">Recently released episodes across all series</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : groupedEpisodes.length === 0 ? (
          <div className="text-center py-16">
            <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Episodes Found</h3>
            <p className="text-muted-foreground">Check back later for new episodes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {groupedEpisodes.map((group, index) => {
              const displayImage = group.thumbnail || group.coverImage || '/placeholder.svg';
              const episodeRangeText = formatEpisodeRange(group.episodeMin, group.episodeMax);
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
                    className="group relative block animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl transition-all duration-500">
                      <img
                        src={displayImage}
                        alt={group.animeTitle}
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play className="h-6 w-6 text-primary-foreground fill-current" />
                        </div>
                      </div>

                      <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                        S{group.seasonNumber}
                      </div>

                      {hasMultipleEpisodes && (
                        <div className="absolute top-2 left-14 px-2 py-1 text-xs font-bold bg-secondary text-secondary-foreground rounded-lg shadow-md">
                          +{group.episodeCount} eps
                        </div>
                      )}

                      {isNew(group.latestCreatedAt) && (
                        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                          NEW
                        </div>
                      )}

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
        )}
      </div>
    </div>
  );
}
