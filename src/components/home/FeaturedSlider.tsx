import { memo, useState, useEffect, useCallback } from 'react';
import { useActiveOnScreen } from '@/hooks/usePerfTier';
import { preloadImages } from '@/lib/imageOptimization';
import { Link } from 'react-router-dom';
import { Play, Info, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { getViewCount, formatViews } from '@/lib/viewCount';

interface FeaturedAnimeItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  banner: string | null;
  genres: string[];
  views: number;
  status: string | null;
  type: string | null;
  year: number | null;
}

const HERO_LINEUP = [
  'Hanaori-san Still Wants to Fight in the Next Life',
  'Smoking Behind the Supermarket with You',
  'Chainsmoker cat',
  'Yowayowa Sensei',
  'The Rising of the Shield Hero',
  'Clevatess',
  'Re: Zero – Starting Life in Another World',
  "Tamon's B-side",
  'Sparks of tomorrow',
  'Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs',
];

const ANIME_FIELDS = 'id, title, description, cover_image, banner_image, genres, view_count, status, type, release_year';

const toItem = (anime: any, overrides: { title?: string | null; cover?: string | null; banner?: string | null } = {}): FeaturedAnimeItem => ({
  id: anime.id,
  title: overrides.title || anime.title,
  description: anime.description,
  thumbnail: overrides.cover || anime.cover_image,
  banner: overrides.banner || anime.banner_image,
  genres: anime.genres || [],
  views: getViewCount(anime.title, anime.view_count),
  status: anime.status,
  type: anime.type,
  year: anime.release_year,
});

/**
 * Full-bleed homepage hero (Re:ANIME-style). Data comes from the
 * admin-managed featured_hero_lineup, falling back to popular titles.
 */
export const FeaturedSlider = memo(function FeaturedSlider() {
  const [sliderRef, isActive] = useActiveOnScreen<HTMLElement>('100px');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedAnime = async () => {
      try {
        const { data: lineup } = await supabase
          .from('featured_hero_lineup')
          .select(`position, custom_title, custom_cover_url, custom_banner_url, is_active, anime:anime_id ( ${ANIME_FIELDS} )`)
          .eq('is_active', true)
          .order('position', { ascending: true });

        const fromLineup = (lineup || [])
          .filter((row: any) => row.anime)
          .map((row: any) => toItem(row.anime, { title: row.custom_title, cover: row.custom_cover_url, banner: row.custom_banner_url }));
        if (fromLineup.length > 0) {
          setFeaturedAnime(fromLineup);
          preloadImages(fromLineup.slice(0, 3).map(a => a.banner || a.thumbnail));
          return;
        }

        const { data, error } = await supabase
          .from('anime')
          .select(ANIME_FIELDS)
          .order('view_count', { ascending: false })
          .limit(60);
        if (error) throw error;
        if (!data?.length) return;

        const norm = (s: string) => s?.toLowerCase().replace(/[\s.]+/g, '') || '';
        const byTitle = (t: string) =>
          data.find(a => a.title?.toLowerCase() === t.toLowerCase()) ||
          data.find(a => a.title?.toLowerCase().includes(t.toLowerCase())) ||
          data.find(a => norm(a.title) === norm(t)) ||
          data.find(a => norm(a.title).includes(norm(t)));

        const matched: typeof data = [];
        const seen = new Set<string>();
        for (const t of HERO_LINEUP) {
          const f = byTitle(t);
          if (f && !seen.has(f.id)) { matched.push(f); seen.add(f.id); }
        }
        const ranked = [...data].sort((a, b) => getViewCount(b.title, b.view_count) - getViewCount(a.title, a.view_count));
        for (const a of ranked) {
          if (matched.length >= 10) break;
          if (!seen.has(a.id)) { matched.push(a); seen.add(a.id); }
        }
        const items = matched.slice(0, 10).map(a => toItem(a));
        setFeaturedAnime(items);
        preloadImages(items.slice(0, 3).map(a => a.banner || a.thumbnail));
      } catch (error) {
        console.error('Error fetching featured anime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedAnime();
  }, []);

  const goTo = useCallback((nextIdx: number) => {
    setCurrentIndex(nextIdx);
    setAnimKey(k => k + 1);
  }, []);

  // Rotates only while visible and when motion is allowed.
  useEffect(() => {
    if (featuredAnime.length < 2 || !isActive || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % featuredAnime.length);
      setAnimKey(k => k + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [currentIndex, featuredAnime.length, isActive]);

  if (loading) return <section className="home-hero"><Skeleton className="w-full h-full rounded-none" /></section>;
  const current = featuredAnime[currentIndex];
  if (!current) return null;

  const meta = [
    current.type ? current.type.toUpperCase() : null,
    current.year ? String(current.year) : null,
    current.status === 'ongoing' ? 'Airing' : current.status === 'completed' ? 'Finished' : null,
  ].filter(Boolean) as string[];

  return (
    <section ref={sliderRef} className="home-hero relative isolate overflow-hidden" aria-label="Featured anime">
      {/* Phones get an exact 16:9 frame so the whole banner is visible; larger screens stay full-bleed. */}
      <div className="home-hero-media">
        <img src={current.banner || current.thumbnail || '/placeholder.svg'} alt="" aria-hidden
          className="home-hero-fill catalogue-fill perf-blur-fill absolute inset-0 w-full h-full object-cover" />
        {featuredAnime.map((anime, index) => (
          <img key={anime.id} src={anime.banner || anime.thumbnail || '/placeholder.svg'}
            alt="" aria-hidden width={1920} height={1080}
            loading={index < 2 ? 'eager' : 'lazy'} decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className={`home-hero-image absolute inset-0 w-full h-full ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`} />
        ))}
        <div className="home-hero-scrim absolute inset-0 pointer-events-none" />
      </div>

      <div className="home-hero-body relative z-10 flex flex-col justify-end px-4 pb-12 md:px-12 md:pb-16">
        <div key={animKey} className="home-hero-copy max-w-xl">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="home-hero-meta is-accent"><Eye className="h-3 w-3" />{formatViews(current.views)}</span>
            {meta.map(m => <span key={m} className="home-hero-meta">{m}</span>)}
          </div>
          <h1 className="mt-3 font-heading font-extrabold text-3xl md:text-5xl leading-[1.05] text-foreground break-words line-clamp-3">{current.title}</h1>
          {current.genres.length > 0 && (
            <p className="mt-2 text-xs text-foreground/70">{current.genres.slice(0, 3).join(' · ')}</p>
          )}
          {current.description && (
            <p className="mt-3 max-w-lg text-xs md:text-sm text-foreground/75 leading-relaxed line-clamp-2 md:line-clamp-3">{current.description}</p>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Link to={`/anime/${current.id}`} className="home-hero-cta is-primary"><span><Play className="h-4 w-4 fill-current" />Watch now</span></Link>
            <Link to={`/anime/${current.id}`} className="home-hero-cta"><span><Info className="h-4 w-4" />Details</span></Link>
          </div>
        </div>
      </div>

      {featuredAnime.length > 1 && (
        <div className="absolute z-10 bottom-4 right-4 md:bottom-7 md:right-12 flex items-center gap-1" aria-label="Featured slides">
          {featuredAnime.map((anime, index) => (
            <button key={anime.id} type="button" aria-label={`Show ${anime.title}`} aria-current={index === currentIndex ? 'true' : undefined}
              onClick={() => goTo(index)} className={`home-hero-dot ${index === currentIndex ? 'is-current' : ''}`}><span /></button>
          ))}
        </div>
      )}
    </section>
  );
});
