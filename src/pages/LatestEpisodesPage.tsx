import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Tv, Sparkles, Layers } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';
import { DubBadge } from '@/components/anime/DubBadge';

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
  isEngDub?: boolean | null;
  isSubOnly?: boolean | null;
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
              updated_at,
              is_eng_dub,
              is_sub_only
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
          isEngDub: (ep.season.anime as any).is_eng_dub ?? false,
          isSubOnly: (ep.season.anime as any).is_sub_only ?? false,
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

  const newCount = groupedEpisodes.filter(g => isNew(g.latestCreatedAt)).length;
  const totalEps = groupedEpisodes.reduce((sum, g) => sum + g.episodeCount, 0);

  return (
    <div className="min-h-screen catalogue-page-v5">
      <ContentNavTabs />

      <SeeAllHeader
        icon={Play}
        title="Latest Episodes"
        subtitle="Recently released episodes across all series — grouped by season for easier browsing."
        eyebrow="Fresh Drops"
        iconGradient="from-primary via-primary to-rose-500"
        glowTone="bg-primary/20"
        stats={[
          { icon: Layers, value: groupedEpisodes.length, label: 'Seasons', tone: 'text-primary' },
          { icon: Tv, value: totalEps, label: 'Episodes', tone: 'text-secondary-foreground' },
          { icon: Sparkles, value: newCount, label: 'New 24h', tone: 'text-primary' },
        ]}
      />

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
                    className="catalogue-tile-v5 group relative block"
                    style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl transition-all duration-500">
                      <img
                        src={displayImage}
                        alt={group.animeTitle}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      
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

                      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                        {isNew(group.latestCreatedAt) && (
                          <div className="px-2 py-0.5 text-xs font-bold bg-secondary text-foreground rounded-lg shadow-md animate-pulse">
                            NEW
                          </div>
                        )}
                        <DubBadge isEngDub={(group as any).isEngDub} isSubOnly={(group as any).isSubOnly} />
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/90 to-transparent">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1 drop-shadow-lg">
                          {group.animeTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
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
