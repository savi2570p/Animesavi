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

      // Cache the slug → id map in sessionStorage so subsequent clicks are instant
      // (previously every detail click refetched the entire anime list, which was
      // the main source of the perceived lag / repeated loading screen).
      let animeList: Array<{ id: string; title: string | null }> | null = null;
      try {
        const cached = sessionStorage.getItem('animeSlugIndex.v1');
        if (cached) animeList = JSON.parse(cached);
      } catch {}

      if (!animeList) {
        const { data, error } = await supabase
          .from('anime_public')
          .select('id, title');
        if (error || !data) { setNotFound(true); return; }
        animeList = data;
        try { sessionStorage.setItem('animeSlugIndex.v1', JSON.stringify(data)); } catch {}
      }

      const anime = animeList.find(a => a.title && createSlug(a.title) === animeSlug);

      if (!anime) {
        setNotFound(true);
        return;
      }

      // If episode slug is provided
      if (episodeSlug) {
        // Parse different episode slug formats:
        // 1. "episode-5" - episode number only
        // 2. "season-1-episode-5" or "s1-e5" - season and episode
        // 3. "s1e5" - compact format
        
        let seasonNumber: number | null = null;
        let episodeNumber: number | null = null;
        
        // Try "season-X-episode-Y" format
        const fullMatch = episodeSlug.match(/^season-(\d+)-episode-(\d+)$/i);
        if (fullMatch) {
          seasonNumber = parseInt(fullMatch[1], 10);
          episodeNumber = parseInt(fullMatch[2], 10);
        }
        
        // Try "sX-eY" format
        if (!episodeNumber) {
          const shortMatch = episodeSlug.match(/^s(\d+)-e(\d+)$/i);
          if (shortMatch) {
            seasonNumber = parseInt(shortMatch[1], 10);
            episodeNumber = parseInt(shortMatch[2], 10);
          }
        }
        
        // Try "sXeY" compact format
        if (!episodeNumber) {
          const compactMatch = episodeSlug.match(/^s(\d+)e(\d+)$/i);
          if (compactMatch) {
            seasonNumber = parseInt(compactMatch[1], 10);
            episodeNumber = parseInt(compactMatch[2], 10);
          }
        }
        
        // Try "episode-X" format (no season specified, defaults to season 1)
        if (!episodeNumber) {
          const episodeMatch = episodeSlug.match(/^episode-(\d+)$/i);
          if (episodeMatch) {
            seasonNumber = 1; // Default to season 1
            episodeNumber = parseInt(episodeMatch[1], 10);
          }
        }
        
        if (episodeNumber) {
          // Get seasons for this anime
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id, season_number')
            .eq('anime_id', anime.id)
            .order('season_number');

          if (seasons && seasons.length > 0) {
            // Find the right season
            let targetSeason = seasons[0]; // Default to first season
            if (seasonNumber) {
              const matchingSeason = seasons.find(s => s.season_number === seasonNumber);
              if (matchingSeason) {
                targetSeason = matchingSeason;
              }
            }
            
            // Find the episode in the target season
            const { data: episode } = await supabase
              .from('episodes')
              .select('id')
              .eq('season_id', targetSeason.id)
              .eq('episode_number', episodeNumber)
              .single();

            if (episode) {
              navigate(`/watch/${episode.id}`, { replace: true });
              return;
            }
            
            // If episode not found in specified season, search all seasons
            for (const season of seasons) {
              const { data: ep } = await supabase
                .from('episodes')
                .select('id')
                .eq('season_id', season.id)
                .eq('episode_number', episodeNumber)
                .single();

              if (ep) {
                navigate(`/watch/${ep.id}`, { replace: true });
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
