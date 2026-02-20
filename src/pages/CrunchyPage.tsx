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
}

export default function CrunchyPage() {
  const [animeList, setAnimeList] = useState<CrunchyAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCrunchyAnime = async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, status')
        .eq('is_crunchyroll', true as any)
        .order('title');

      if (!error && data) {
        setAnimeList(data);
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
                <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {anime.title}
                </h3>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
