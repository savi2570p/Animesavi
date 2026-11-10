import { useState, useEffect } from 'react';
import { PosterCard } from '@/components/anime/PosterCard';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Star, Subtitles } from 'lucide-react';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';

interface SubAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  release_year: number | null;
  genres: string[] | null;
}

export default function SubOnlyPage() {
  const [animeList, setAnimeList] = useState<SubAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'series' | 'movie'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('anime')
        .select('id, title, cover_image, type, status, release_year, genres')
        .eq('is_sub_only', true)
        .order('created_at', { ascending: false });
      setAnimeList((data || []) as SubAnime[]);
      setIsLoading(false);
    })();
  }, []);

  const filtered = animeList.filter((a) =>
    filter === 'all' ? true : filter === 'movie' ? a.type === 'movie' : a.type !== 'movie'
  );

  return (
    <div className="min-h-screen bg-background">
      <ContentNavTabs />

      <div className="container py-6 md:py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
            <Subtitles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold">
              SUB<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">-ONLY</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">Original Japanese audio with subtitles</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'series', 'movie'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'series' ? 'Series' : 'Movies'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="browse-ra-grid">
            {Array(12).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="browse-ra-grid">
            {filtered.map((item) => (
              <PosterCard key={item.id} to={`/anime/${item.id}`} title={item.title} cover={item.cover_image} isSubOnly
                genres={(item as any).genres} type={(item as any).type ?? 'series'} year={(item as any).release_year} status={(item as any).status} fluid />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
