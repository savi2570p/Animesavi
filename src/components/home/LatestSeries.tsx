import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tv, ChevronRight, Play, CalendarClock } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface AnimeSeries {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
  episode_count: number;
  status: string | null;
  latest_episode_date: string | null;
}

export function LatestSeries() {
  const [series, setSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSeries();
  }, []);

  const fetchLatestSeries = async () => {
    try {
      // Fetch ALL anime series with larger limit to ensure we get all with episodes
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select(`
          id,
          title,
          cover_image,
          created_at,
          updated_at,
          type,
          status
        `)
        .eq('type', 'series')
        .order('updated_at', { ascending: false })
        .limit(100); // Increased limit to get more anime

      if (animeError) throw animeError;

      // Batch fetch all seasons for all anime at once for better performance
      const animeIds = (animeData || []).map(a => a.id);
      
      const { data: allSeasons } = await supabase
        .from('seasons')
        .select('id, anime_id')
        .in('anime_id', animeIds);

      // Group seasons by anime_id
      const seasonsByAnime = new Map<string, string[]>();
      (allSeasons || []).forEach(season => {
        const existing = seasonsByAnime.get(season.anime_id) || [];
        existing.push(season.id);
        seasonsByAnime.set(season.anime_id, existing);
      });

      // Get all season IDs for batch episode query
      const allSeasonIds = (allSeasons || []).map(s => s.id);

      // Paginate episodes to avoid 1000-row limit
      const allEpisodes: { id: string; season_id: string; created_at: string }[] = [];
      if (allSeasonIds.length > 0) {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: batch } = await supabase
            .from('episodes')
            .select('id, season_id, created_at')
            .in('season_id', allSeasonIds)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (batch) allEpisodes.push(...batch);
          hasMore = (batch?.length || 0) === pageSize;
          offset += pageSize;
        }
      }

      // Group episodes by season_id and count
      const episodesByAnime = new Map<string, { count: number; latestDate: string | null }>();
      
      allEpisodes.forEach(episode => {
        // Find which anime this episode belongs to
        for (const [animeId, seasonIds] of seasonsByAnime.entries()) {
          if (seasonIds.includes(episode.season_id)) {
            const existing = episodesByAnime.get(animeId) || { count: 0, latestDate: null };
            existing.count++;
            if (!existing.latestDate || new Date(episode.created_at) > new Date(existing.latestDate)) {
              existing.latestDate = episode.created_at;
            }
            episodesByAnime.set(animeId, existing);
            break;
          }
        }
      });

      // Build series with data - ONLY include anime with episodes > 0
      const seriesWithData: AnimeSeries[] = (animeData || [])
        .map((anime) => {
          const episodeData = episodesByAnime.get(anime.id) || { count: 0, latestDate: null };
          return {
            ...anime,
            episode_count: episodeData.count,
            latest_episode_date: episodeData.latestDate
          };
        })
        .filter(anime => anime.episode_count > 0); // Filter out anime with zero episodes

      // Sort by latest episode date (most recently uploaded episodes first)
      seriesWithData.sort((a, b) => {
        const dateA = a.latest_episode_date || a.updated_at || a.created_at;
        const dateB = b.latest_episode_date || b.updated_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Take first 12 to show more anime with recent uploads
      setSeries(seriesWithData.slice(0, 12));
    } catch (error) {
      console.error('Error fetching latest series:', error);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (anime: AnimeSeries) => {
    // Check if the latest episode or the anime itself was created/updated within last 24 hours
    const dateToCheck = anime.latest_episode_date || anime.updated_at || anime.created_at;
    const date = new Date(dateToCheck);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  const getStatusBadge = (anime: AnimeSeries) => {
    if (anime.status === 'upcoming') {
      return (
        <div className="absolute top-10 left-2 px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-lg shadow-md animate-pulse flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          Coming Soon
        </div>
      );
    }
    if (anime.status === 'completed') {
      return (
        <div className="absolute top-10 left-2 px-2 py-1 text-xs font-bold bg-green-600 text-white rounded-lg shadow-md">
          COMPLETE
        </div>
      );
    }
    return null;
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
            <Link to="/latest-series" className="flex items-center gap-1">
              See All
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          {series.slice(0, 12).map((anime, index) => (
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
                  {isNew(anime) && (
                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                      NEW
                    </div>
                  )}

                  {/* Status Badge */}
                  {getStatusBadge(anime)}

                  {/* Token Crown Badge */}
                  <TokenCrownBadge />

                  {/* Title at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 drop-shadow-lg">
                      {anime.title}
                    </h3>
                    {anime.episode_count > 0 && (
                      <p className="text-xs text-white/70 mt-1">
                        {anime.episode_count} Episode{anime.episode_count !== 1 ? 's' : ''}
                      </p>
                    )}
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
