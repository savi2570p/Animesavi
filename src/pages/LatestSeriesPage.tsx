import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tv, Play, CalendarClock, Sparkles, Film, Flame } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';
import { DubBadge } from '@/components/anime/DubBadge';

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

export default function LatestSeriesPage() {
  const [series, setSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSeries();
  }, []);

  const fetchLatestSeries = async () => {
    try {
      const { data: animeData, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, created_at, updated_at, type, status, is_eng_dub, is_sub_only')
        .eq('type', 'series')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (animeError) throw animeError;
      if (!animeData || animeData.length === 0) { setSeries([]); return; }

      const animeIds = animeData.map(a => a.id);

      const { data: allSeasons } = await supabase
        .from('seasons')
        .select('id, anime_id')
        .in('anime_id', animeIds);

      if (!allSeasons || allSeasons.length === 0) { setSeries([]); return; }

      const seasonsByAnime = new Map<string, string[]>();
      allSeasons.forEach(s => {
        const arr = seasonsByAnime.get(s.anime_id) || [];
        arr.push(s.id);
        seasonsByAnime.set(s.anime_id, arr);
      });

      const allSeasonIds = allSeasons.map(s => s.id);

      // Batch fetch episodes in chunks of 50 season IDs to avoid query limits
      const allEpisodes: { id: string; season_id: string; created_at: string }[] = [];
      const chunkSize = 50;
      for (let i = 0; i < allSeasonIds.length; i += chunkSize) {
        const chunk = allSeasonIds.slice(i, i + chunkSize);
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: batch } = await supabase
            .from('episodes')
            .select('id, season_id, created_at')
            .in('season_id', chunk)
            .order('created_at', { ascending: false })
            .range(offset, offset + 999);
          if (batch) allEpisodes.push(...batch);
          hasMore = (batch?.length || 0) === 1000;
          offset += 1000;
        }
      }

      const episodesByAnime = new Map<string, { count: number; latestDate: string | null }>();
      allEpisodes.forEach(ep => {
        for (const [animeId, seasonIds] of seasonsByAnime.entries()) {
          if (seasonIds.includes(ep.season_id)) {
            const existing = episodesByAnime.get(animeId) || { count: 0, latestDate: null };
            existing.count++;
            if (!existing.latestDate || new Date(ep.created_at) > new Date(existing.latestDate)) {
              existing.latestDate = ep.created_at;
            }
            episodesByAnime.set(animeId, existing);
            break;
          }
        }
      });

      const seriesWithData: AnimeSeries[] = animeData
        .map(anime => {
          const epData = episodesByAnime.get(anime.id) || { count: 0, latestDate: null };
          return { ...anime, episode_count: epData.count, latest_episode_date: epData.latestDate };
        })
        .filter(a => a.episode_count > 0);

      seriesWithData.sort((a, b) => {
        const dateA = a.latest_episode_date || a.updated_at || a.created_at;
        const dateB = b.latest_episode_date || b.updated_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setSeries(seriesWithData);
    } catch (error) {
      console.error('Error fetching latest series:', error);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (anime: AnimeSeries) => {
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

  const newCount = series.filter(a => isNew(a)).length;
  const ongoingCount = series.filter(a => a.status === 'ongoing' || (!a.status && a.episode_count > 0)).length;
  const totalEps = series.reduce((sum, a) => sum + a.episode_count, 0);

  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      <SeeAllHeader
        icon={Tv}
        title="Latest Series"
        subtitle="Recently updated anime series with new episodes — sorted by latest activity."
        eyebrow="Trending Series"
        iconGradient="from-primary via-primary to-rose-500"
        glowTone="bg-primary/20"
        stats={[
          { icon: Film, value: series.length, label: 'Series', tone: 'text-primary' },
          { icon: Play, value: totalEps, label: 'Episodes', tone: 'text-blue-400' },
          { icon: Flame, value: ongoingCount, label: 'Ongoing', tone: 'text-orange-400' },
          { icon: Sparkles, value: newCount, label: 'New 24h', tone: 'text-emerald-400' },
        ]}
      />

      <div className="container pb-12">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : series.length === 0 ? (
          <div className="text-center py-16">
            <Tv className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Series Found</h3>
            <p className="text-muted-foreground">Check back later for new series.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {series.map((anime, index) => (
              <AnimeCardContextMenu
                key={anime.id}
                animeTitle={anime.title}
                animeUrl={`/anime/${anime.id}`}
                coverImage={anime.cover_image}
              >
                <Link
                  to={`/anime/${anime.id}`}
                  className="group relative block animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted shadow-md group-hover:shadow-xl transition-all duration-500">
                    <img
                      src={anime.cover_image || '/placeholder.svg'}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-all duration-300" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <Play className="h-6 w-6 text-primary-foreground fill-current" />
                      </div>
                    </div>

                    <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                      {anime.episode_count} EP{anime.episode_count !== 1 ? 'S' : ''}
                    </div>

                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {isNew(anime) && (
                        <div className="px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded-lg shadow-md animate-pulse">
                          NEW
                        </div>
                      )}
                      <DubBadge isEngDub={(anime as any).is_eng_dub} isSubOnly={(anime as any).is_sub_only} />
                    </div>

                    {getStatusBadge(anime)}

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
        )}
      </div>
    </div>
  );
}
