import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

// Utility to create slug from title
const createSlug = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export default function AnimeSlugRedirect() {
  const { animeSlug, episodeSlug } = useParams<{ animeSlug: string; episodeSlug?: string }>();
  const navigate = useNavigate();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const findAnimeAndRedirect = async () => {
      if (!animeSlug) {
        setNotFound(true);
        return;
      }

      // Fetch all anime and find the one matching the slug
      const { data: animeList, error } = await supabase
        .from('anime_public')
        .select('id, title');

      if (error || !animeList) {
        setNotFound(true);
        return;
      }

      // Find anime by matching slug
      const anime = animeList.find(a => a.title && createSlug(a.title) === animeSlug);

      if (!anime) {
        setNotFound(true);
        return;
      }

      // If episode slug is provided (e.g., "episode-5")
      if (episodeSlug) {
        const episodeMatch = episodeSlug.match(/^episode-(\d+)$/);
        if (episodeMatch) {
          const episodeNumber = parseInt(episodeMatch[1], 10);

          // Find the episode by anime and episode number
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', anime.id)
            .order('season_number');

          if (seasons && seasons.length > 0) {
            // Search through seasons to find the episode
            for (const season of seasons) {
              const { data: episode } = await supabase
                .from('episodes')
                .select('id')
                .eq('season_id', season.id)
                .eq('episode_number', episodeNumber)
                .single();

              if (episode) {
                navigate(`/watch/${episode.id}`, { replace: true });
                return;
              }
            }
          }
        }
        // Episode not found, redirect to anime page
        navigate(`/anime/${anime.id}`, { replace: true });
      } else {
        // No episode, redirect to anime detail page
        navigate(`/anime/${anime.id}`, { replace: true });
      }
    };

    findAnimeAndRedirect();
  }, [animeSlug, episodeSlug, navigate]);

  if (notFound) {
    navigate('/404', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
