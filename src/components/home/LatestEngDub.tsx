import { memo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Mic, Play, ChevronRight, Star, Globe } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

interface EngDubItem {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  type: string | null;
  created_at: string;
  firstEpisodeId?: string | null;
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

  if (loading) {
    return (
      <section className="py-10 md:py-14 relative overflow-hidden">
        <div className="container">
          <div className="h-12 w-72 bg-muted/40 animate-pulse rounded-xl mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-[160px] md:w-[200px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 left-1/4 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 shadow-[0_8px_30px_-8px_hsl(210_90%_55%/0.7)]">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse ring-2 ring-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight">
                  ENG <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">DUB</span>
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <Globe className="h-2.5 w-2.5" />
                  English
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Officially dubbed anime series & movies in English
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link to="/eng-dub" className="flex items-center gap-1">
              See all
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-row scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {items.map((item, index) => (
            <AnimeCardContextMenu
              key={item.id}
              animeTitle={item.title}
              animeUrl={`/anime/${item.id}`}
              coverImage={item.cover_image}
            >
              <Link
                to={`/anime/${item.id}`}
                className={`group relative block stagger-${Math.min(index + 1, 8)} animate-fade-in gpu-accelerate w-[160px] md:w-[200px] lg:w-[220px] shrink-0`}
              >
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-500 ring-1 ring-white/5 group-hover:ring-sky-400/50">
                  {item.cover_image && (
                    <img
                      src={item.cover_image}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ filter: 'blur(24px) brightness(0.4)' }}
                    />
                  )}
                  <img
                    src={item.cover_image || '/placeholder.svg'}
                    alt={item.title}
                    className="relative z-[2] w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    loading="lazy"
                  />

                  <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 z-[3] bg-gradient-to-tr from-sky-500/25 via-transparent to-indigo-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <span className="absolute top-2 left-2 z-[5] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    <Mic className="h-2.5 w-2.5" />
                    ENG DUB
                  </span>

                  <div className="absolute top-2 right-2 z-[5] flex flex-col gap-1 items-end">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
                      4K
                    </span>
                  </div>

                  <div className="pointer-events-none">
                    <TokenCrownBadge />
                  </div>

                  <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="p-3 rounded-full bg-sky-500/95 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="h-5 w-5 text-white fill-current" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-[5] p-3 pointer-events-none">
                    <h3 className="text-sm md:text-base font-semibold text-white line-clamp-2 leading-tight drop-shadow-lg">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/80">
                      {item.release_year && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 backdrop-blur-sm font-semibold">
                          {item.release_year}
                        </span>
                      )}
                      {item.genres?.[0] && (
                        <span className="flex items-center gap-1 text-white/75 truncate">
                          <Star className="h-2.5 w-2.5 text-sky-400" />
                          {item.genres[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </AnimeCardContextMenu>
          ))}
        </div>
      </div>
    </section>
  );
});
