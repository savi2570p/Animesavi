import { memo, useState, useEffect } from 'react';
import { GlassCatalogueRow } from './GlassCatalogueRow';
import { supabase } from '@/integrations/supabase/client';
import { Film } from 'lucide-react';

interface Movie {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  created_at: string;
  view_count: number | null;
  status: string | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
  firstEpisodeId?: string | null;
}

export const LatestMovies = memo(function LatestMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLatestMovies(); }, []);

  const fetchLatestMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .eq('type', 'movie')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      const moviesWithEpisodes = await Promise.all(
        (data || []).map(async (movie) => {
          const { data: seasons } = await supabase
            .from('seasons').select('id').eq('anime_id', movie.id).order('season_number').limit(1);
          if (seasons && seasons.length > 0) {
            const { data: episodes } = await supabase
              .from('episodes').select('id').eq('season_id', seasons[0].id).order('episode_number').limit(1);
            return { ...movie, firstEpisodeId: episodes?.[0]?.id || null };
          }
          return { ...movie, firstEpisodeId: null };
        })
      );
      setMovies(moviesWithEpisodes);
    } catch (e) {
      console.error('Error fetching latest movies:', e);
    } finally {
      setLoading(false);
    }
  };

  return <GlassCatalogueRow title="Latest Movies" eyebrow="Cinema collection" href="/latest-movies" icon={Film} items={movies} loading={loading} movies />;
});
