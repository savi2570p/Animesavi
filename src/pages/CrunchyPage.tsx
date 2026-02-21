import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';

interface CrunchyAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  episode_count?: number;
  latest_episode_at?: string | null;
}

export default function CrunchyPage() {
  const [animeList, setAnimeList] = useState<CrunchyAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCrunchyAnime = async () => {
      // Fetch crunchy anime
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, status')
        .eq('is_crunchyroll', true as any)
        .order('title');

      if (!error && data) {
        // For each anime, get episode count and latest episode date
        const enriched = await Promise.all(
          data.map(async (anime) => {
            const { count } = await supabase
              .from('episodes')
              .select('id', { count: 'exact', head: true })
              .in('season_id', 
                (await supabase.from('seasons').select('id').eq('anime_id', anime.id)).data?.map(s => s.id) || []
              );
            
            const { data: latestEp } = await supabase
              .from('episodes')
              .select('created_at, season_id')
              .in('season_id',
                (await supabase.from('seasons').select('id').eq('anime_id', anime.id)).data?.map(s => s.id) || []
              )
              .order('created_at', { ascending: false })
              .limit(1);

            return {
              ...anime,
              episode_count: count || 0,
              latest_episode_at: latestEp?.[0]?.created_at || null,
            };
          })
        );

        // Sort: newest episode first, then anime with 0 episodes at the end
        enriched.sort((a, b) => {
          // Both have episodes - sort by latest episode date
          if (a.latest_episode_at && b.latest_episode_at) {
            return new Date(b.latest_episode_at).getTime() - new Date(a.latest_episode_at).getTime();
          }
          // One has episodes, one doesn't - episodes first
          if (a.latest_episode_at && !b.latest_episode_at) return -1;
          if (!a.latest_episode_at && b.latest_episode_at) return 1;
          // Both have no episodes - alphabetical
          return a.title.localeCompare(b.title);
        });

        setAnimeList(enriched);
      }
      setIsLoading(false);
    };
    fetchCrunchyAnime();
  }, []);

  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      {/* Header */}
      <div className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="container relative">
          <div className="flex items-center gap-4 mb-4">
            <img src={crunchyrollLogo} alt="Crunchy" className="h-10 md:h-12 w-auto object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold">Crunchy</h1>
              <p className="text-muted-foreground">Curated anime collection</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : animeList.length === 0 ? (
          <div className="text-center py-16">
            <img src={crunchyrollLogo} alt="Crunchy" className="h-16 w-auto mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Crunchy Anime Yet</h3>
            <p className="text-muted-foreground">Check back soon for curated content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  {anime.cover_image ? (
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                  {anime.type && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">
                      {anime.type}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                  {anime.episode_count === 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
                      Under Progress
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
