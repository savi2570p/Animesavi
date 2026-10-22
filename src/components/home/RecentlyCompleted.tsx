import { useEffect, useState } from 'react';
import { GlassCatalogueRow } from './GlassCatalogueRow';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle } from 'lucide-react';

interface CompletedAnime {
  id: string;
  title: string;
  cover_image: string | null;
  watched_at: string;
  genres?: string[] | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
}

export function RecentlyCompleted() {
  const { user } = useAuth();
  const [completedAnime, setCompletedAnime] = useState<CompletedAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Stale-response guard: an in-flight fetch is discarded when the user
    // changes or the component unmounts (prevents state updates after unmount).
    let cancelled = false;
    if (user) {
      void fetchCompletedAnime(() => !cancelled);
    } else {
      setIsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fetchCompletedAnime = async (isActive: () => boolean) => {
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
          is_eng_dub,
          is_sub_only,
          genres
        )
      `)
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false });

    if (error) {
      console.error('Error fetching watched anime:', error);
      if (isActive()) setIsLoading(false);
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

    // Episode totals in 2 batched queries instead of a per-anime/per-season
    // waterfall (previously 1 + N + M sequential round-trips).
    const animeIds = [...animeMap.keys()];
    const result: CompletedAnime[] = [];

    if (animeIds.length > 0) {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, anime_id')
        .in('anime_id', animeIds);

      const seasonIds = (seasons ?? []).map((s) => s.id);
      const seasonToAnime = new Map<string, string>();
      (seasons ?? []).forEach((s) => seasonToAnime.set(s.id, s.anime_id));

      const totals = new Map<string, number>();
      if (seasonIds.length > 0) {
        const { data: episodes } = await supabase
          .from('episodes')
          .select('id, season_id')
          .in('season_id', seasonIds);

        (episodes ?? []).forEach((ep) => {
          const animeId = seasonToAnime.get(ep.season_id);
          if (!animeId) return;
          totals.set(animeId, (totals.get(animeId) ?? 0) + 1);
        });
      }

      for (const [animeId, data] of animeMap) {
        const totalEpisodes = totals.get(animeId) ?? 0;
        // Only include if ALL episodes are completed
        if (totalEpisodes > 0 && data.completedEpisodes.size >= totalEpisodes) {
          result.push({
            id: data.anime.id,
            title: data.anime.title,
            cover_image: data.anime.cover_image,
            watched_at: data.latestWatch,
            genres: data.anime.genres,
            is_eng_dub: data.anime.is_eng_dub ?? false,
            is_sub_only: (data.anime as any).is_sub_only ?? false,
          });
        }
      }
    }

    // Sort by watch date (most recent first)
    result.sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());

    if (!isActive()) return;
    setCompletedAnime(result.slice(0, 8));
    setIsLoading(false);
  };

  // Don't show section if user is not logged in or no completed anime
  if (!user || (!isLoading && completedAnime.length === 0)) {
    return null;
  }

  return <GlassCatalogueRow title="Recently Completed" eyebrow="Finished watching" href="/history" icon={CheckCircle} items={completedAnime} loading={isLoading} finished />;
}
