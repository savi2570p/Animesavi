import { memo, useState, useEffect } from 'react';
import { GlassCatalogueRow } from './GlassCatalogueRow';
import { supabase } from '@/integrations/supabase/client';
import { Mic } from 'lucide-react';

interface EngDubItem {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  type: string | null;
  created_at: string;
  firstEpisodeId?: string | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
}

export const LatestEngDub = memo(function LatestEngDub() {
  const [items, setItems] = useState<EngDubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEngDub(); }, []);

  const fetchEngDub = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('anime')
        .select('*')
        .eq('is_eng_dub', true)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      const withEpisodes = await Promise.all(
        (data || []).map(async (a: any) => {
          const { data: seasons } = await supabase
            .from('seasons').select('id').eq('anime_id', a.id).order('season_number').limit(1);
          if (seasons && seasons.length > 0) {
            const { data: episodes } = await supabase
              .from('episodes').select('id').eq('season_id', seasons[0].id).order('episode_number').limit(1);
            return { ...a, firstEpisodeId: episodes?.[0]?.id || null } as EngDubItem;
          }
          return { ...a, firstEpisodeId: null } as EngDubItem;
        })
      );
      setItems(withEpisodes);
    } catch (e) {
      console.error('Error fetching ENG DUB:', e);
    } finally {
      setLoading(false);
    }
  };

  return <GlassCatalogueRow title="ENG DUB" eyebrow="English collection" href="/eng-dub" icon={Mic} items={items} loading={loading} />;
});
