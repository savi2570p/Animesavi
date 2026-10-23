import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Eye, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { DubBadge } from '@/components/anime/DubBadge';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { getViewCount, formatViews } from '@/lib/viewCount';

interface PopularAnime {
  id: string; title: string; cover_image: string | null; view_count: number;
  genres: string[] | null; is_eng_dub: boolean | null; is_sub_only: boolean | null;
}
export function MostPopularSection() {
  const [items, setItems] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.from('anime').select('id,title,cover_image,view_count,genres,is_eng_dub,is_sub_only')
      .order('view_count', { ascending: false }).limit(10).then(({ data }) => {
        if (!active) return;
        setItems((data ?? []).map(item => ({ ...item, view_count: getViewCount(item.title, item.view_count) })).sort((a,b) => b.view_count-a.view_count));
        setLoading(false);
      });
    return () => { active = false; };
  }, []);
  if (!loading && !items.length) return null;
  return <section className="catalogue-section py-6 mb-8" aria-label="Top 10 Most Popular">
    <div className="flex items-end justify-between gap-3 mb-5">
      <div><p className="flex items-center gap-1.5 text-xs text-primary mb-1"><Crown className="h-3.5 w-3.5" /> All-time favourites</p><h2 className="text-2xl md:text-3xl font-heading font-bold">Top 10 Most Popular</h2></div>
      <span className="text-xs text-muted-foreground tabular-nums">{formatViews(items.reduce((total,item) => total+item.view_count,0))} views</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      {loading ? Array.from({length:3},(_,i)=><Skeleton key={i} className="h-48 md:h-60 rounded-xl" />) : items.slice(0,3).map((item,index) => <Link key={item.id} to={`/anime/${item.id}`} className="catalogue-glass rounded-xl overflow-hidden group flex min-h-48 md:min-h-60">
        <div className="relative w-[120px] h-[180px] shrink-0 self-center overflow-hidden ml-3 rounded-xl">
          <img src={item.cover_image || '/placeholder.svg'} alt="" aria-hidden className="catalogue-fill perf-blur-fill absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <img src={item.cover_image || '/placeholder.svg'} alt={item.title} className="relative h-full w-full object-contain" loading="lazy" />
          <TokenCrownBadge />
        </div>
        <div className="p-4 flex flex-col min-w-0 flex-1"><div className="flex justify-between items-start gap-2"><span className="text-4xl font-heading font-bold text-primary tabular-nums">0{index+1}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div><div className="mt-auto space-y-2"><DubBadge isEngDub={item.is_eng_dub} isSubOnly={item.is_sub_only} genres={item.genres} /><h3 className="text-sm font-semibold line-clamp-3">{item.title}</h3><span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{formatViews(item.view_count)}</span></div></div>
      </Link>)}
    </div>
    <div className="flex gap-3 overflow-x-auto snap-row pb-3">
      {items.slice(3).map((item,index)=><Link key={item.id} to={`/anime/${item.id}`} className="catalogue-glass rounded-xl overflow-hidden w-[120px] shrink-0 group">
        <div className="relative w-[120px] h-[180px] overflow-hidden"><img src={item.cover_image || '/placeholder.svg'} alt="" aria-hidden className="catalogue-fill perf-blur-fill absolute inset-0 h-full w-full object-cover" loading="lazy" /><img src={item.cover_image || '/placeholder.svg'} alt={item.title} className="relative h-full w-full object-contain" loading="lazy" /><span className="catalogue-chip absolute top-1.5 left-1.5 rounded px-1 text-xs">{String(index+4).padStart(2,'0')}</span></div>
        <div className="p-2 space-y-2"><DubBadge isEngDub={item.is_eng_dub} isSubOnly={item.is_sub_only} genres={item.genres} /><h3 className="text-xs font-semibold line-clamp-2 h-8">{item.title}</h3><p className="text-[10px] text-muted-foreground">{formatViews(item.view_count)} views</p></div>
      </Link>)}
    </div>
  </section>;
}
