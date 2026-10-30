import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMatureFilter } from '@/lib/playbackPreferences';

export interface HomeSeries {
  id: string; title: string; cover_image: string | null; created_at: string;
  updated_at: string; status: string | null; latest_episode_date: string;
  episode_count: number; is_eng_dub: boolean | null; is_sub_only: boolean | null;
  genres: string[] | null;
}
export interface HomeEpisode {
  id: string; title: string; episode_number: number; thumbnail: string | null;
  created_at: string; duration: number | null;
  season: { season_number: number; anime: HomeSeries & { type: string | null } };
}
export function useHomeCatalogue() {
  const matureFilter = useMatureFilter();
  return useQuery({
    queryKey: ['home-latest-catalogue', matureFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('home_latest_catalogue');
      if (error) throw error;
      return data as unknown as { series: HomeSeries[]; episodes: HomeEpisode[] };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}