import { memo, useState, useEffect } from 'react';
import { GlassCatalogueRow } from './GlassCatalogueRow';
import { supabase } from '@/integrations/supabase/client';
import { Subtitles } from 'lucide-react';

interface SubItem {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  type: string | null;
  created_at: string;
  is_sub_only: boolean;
}

export const LatestSubOnly = memo(function LatestSubOnly() {
  const [items, setItems] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('anime')
          .select('id, title, cover_image, release_year, genres, type, created_at, is_sub_only')
          .eq('is_sub_only', true)
          .order('created_at', { ascending: false })
          .limit(8);
        if (error) throw error;
        setItems((data || []) as SubItem[]);
      } catch (e) {
        console.error('Error fetching SUB ONLY:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return <GlassCatalogueRow title="SUB-ONLY" eyebrow="Japanese collection" href="/sub-only" icon={Subtitles} items={items} loading={loading} />;
});
