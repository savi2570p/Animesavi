import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filtered.map((item) => (
              <Link key={item.id} to={`/anime/${item.id}`} className="group relative block">
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted ring-1 ring-white/5 group-hover:ring-emerald-400/50 transition-all duration-300">
                  {item.cover_image && (
                    <img
                      src={item.cover_image}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: 'blur(24px) brightness(0.4)' }}
                    />
                  )}
                  <img
                    src={item.cover_image || '/placeholder.svg'}
                    alt={item.title}
                    loading="lazy"
                    className="relative z-[2] w-full h-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 z-[3] bg-gradient-to-t from-black via-black/55 to-transparent" />

                  <span className="absolute top-2 left-2 z-[5] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/95 text-white text-[10px] font-bold uppercase tracking-wider">
                    <Subtitles className="h-2.5 w-2.5" />
                    SUB
                  </span>
                  <span className="absolute top-2 right-2 z-[5] text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                    4K
                  </span>
                  <div className="pointer-events-none"><TokenCrownBadge /></div>

                  <div className="absolute inset-0 z-[4] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-3 rounded-full bg-emerald-500/95">
                      <Play className="h-5 w-5 text-white fill-current" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-[5] p-3">
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">{item.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-white/80">
                      {item.release_year && <span className="px-1.5 py-0.5 rounded bg-white/10">{item.release_year}</span>}
                      {item.genres?.[0] && (
                        <span className="flex items-center gap-1 truncate">
                          <Star className="h-2.5 w-2.5 text-emerald-400" />
                          {item.genres[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
