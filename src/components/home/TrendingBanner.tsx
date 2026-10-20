import { memo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useActiveOnScreen } from '@/hooks/usePerfTier';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DubBadge } from '@/components/anime/DubBadge';
import { ArrowLeft, ArrowRight, Play, TrendingUp, Eye, Pause } from 'lucide-react';

interface TrendingAnime {
  id: string; title: string; cover_image: string | null; banner_image: string | null;
  view_count: number | null; genres: string[] | null; status: string | null;
  is_eng_dub: boolean | null; is_sub_only: boolean | null;
}
// Curated trending titles in priority order
const TRENDING_TITLES = [
  'Hanaori-san Still Wants to Fight in the Next Life',
  'Grand Blue Dreaming',
  'Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs',
  'Witch Hat Atelier',
  'Wistoria: Wand and Sword',
  'Liar Game',
  'Snowball Earth',
];

const TRENDING_LIMIT = 6;
const ROTATE_INTERVAL = 6000;


const FIELDS = 'id, title, cover_image, banner_image, view_count, genres, status, is_eng_dub, is_sub_only';
export const TrendingBanner = memo(function TrendingBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sectionRef, isActive] = useActiveOnScreen<HTMLElement>('0px');
  const { data: trending = [], isPending } = useQuery({
    queryKey: ['home-trending-v2'], staleTime: 5 * 60_000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const [curated, popular] = await Promise.all([
        supabase.from('anime_public').select(FIELDS).in('title', TRENDING_TITLES).limit(7),
        supabase.from('anime_public').select(FIELDS).order('view_count', { ascending: false }).limit(TRENDING_LIMIT),
      ]);
      if (curated.error) throw curated.error;
      if (popular.error) throw popular.error;
      const candidates = [...(curated.data || []).sort((a, b) => TRENDING_TITLES.indexOf(a.title || '') - TRENDING_TITLES.indexOf(b.title || '')), ...(popular.data || [])];
      const seen = new Set<string>();
      return candidates.filter(a => { if (!a.id || seen.has(a.id)) return false; seen.add(a.id); return true; }).slice(0, TRENDING_LIMIT) as TrendingAnime[];
    },
  });
  useEffect(() => {
    if (!isActive || paused || trending.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setActiveIndex(i => (i + 1) % trending.length), ROTATE_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isActive, paused, trending.length]);
  const current = trending[activeIndex % Math.max(1, trending.length)];
  if (!isPending && !current) return null;
  return <section ref={sectionRef} className="py-6 md:py-9" aria-label="Trending Now">
    <div className="container">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div><span className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground mb-1"><TrendingUp className="h-3 w-3 text-primary" />In the spotlight</span><h2 className="font-heading text-xl md:text-3xl font-bold">Trending Now</h2></div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={paused ? 'Play trending slideshow' : 'Pause trending slideshow'} onClick={() => setPaused(p => !p)}>{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous trending title" onClick={() => setActiveIndex(i => (i - 1 + trending.length) % Math.max(1, trending.length))}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next trending title" onClick={() => setActiveIndex(i => (i + 1) % Math.max(1, trending.length))}><ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {current ? <div className="trending-v2 relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <img key={current.id} src={current.banner_image || current.cover_image || '/placeholder.svg'} alt={current.title} className="absolute inset-0 w-full h-full object-cover" decoding="async" />
        <div className="absolute inset-0 trending-v2-scrim pointer-events-none" />
        <div className="absolute top-4 left-4 md:top-6 md:left-6 catalogue-chip rounded px-2.5 py-1 text-[10px] font-bold">#{String(activeIndex + 1).padStart(2, '0')} TRENDING</div>
        <div className="absolute bottom-5 md:bottom-8 left-4 md:left-8 right-4 md:right-8 flex items-end justify-between gap-5">
          <div className="min-w-0 max-w-xl">
            <div className="flex flex-wrap items-center gap-2 mb-2"><DubBadge isEngDub={current.is_eng_dub} isSubOnly={current.is_sub_only} genres={current.genres} /><span className="catalogue-chip rounded text-[9px] px-1.5 py-0.5">4K</span></div>
            <h3 className="font-heading text-xl md:text-4xl font-bold leading-tight line-clamp-2 text-foreground">{current.title}</h3>
            <div className="flex gap-3 items-center mt-2 text-xs text-foreground/80"><span>{current.genres?.filter(g => !['Hindi', 'English'].includes(g)).slice(0, 2).join(' · ')}</span>{!!current.view_count && <span className="hidden sm:flex items-center gap-1"><Eye className="h-3 w-3" />{Intl.NumberFormat('en', { notation: 'compact' }).format(current.view_count)}</span>}</div>
            <Button asChild size="sm" className="mt-4"><Link to={`/anime/${current.id}`}><Play className="h-3.5 w-3.5 fill-current mr-1.5" />Watch Now</Link></Button>
          </div>
          <Link to={`/anime/${current.id}`} className="trending-poster catalogue-glass hidden lg:block shrink-0 rounded-xl overflow-hidden w-[120px] h-[180px]"><img src={current.cover_image || '/placeholder.svg'} alt={`${current.title} poster`} loading="lazy" className="w-full h-full object-contain" /></Link>
        </div>
      </div> : <Skeleton className="trending-v2" />}
      <div className="flex gap-1.5 mt-3" role="group" aria-label="Trending slides">
        {trending.map((anime, i) => <Button key={anime.id} variant="ghost" aria-label={`Show ${anime.title}`} aria-pressed={i === activeIndex} onClick={() => setActiveIndex(i)} className="flex-1 h-7 p-0 rounded-none hover:bg-transparent"><span className={`h-[3px] w-full rounded-full ${i === activeIndex ? 'bg-primary' : 'bg-border'}`} /></Button>)}
      </div>
    </div>
  </section>;
});
