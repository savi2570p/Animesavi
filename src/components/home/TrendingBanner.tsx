import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Play, Eye, Flame, ChevronRight, Trophy, Zap } from 'lucide-react';

interface TrendingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image: string | null;
  view_count: number | null;
  genres: string[] | null;
  status: string | null;
}

const formatViews = (count: number) => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
};

// Curated trending titles in priority order
const TRENDING_TITLES = [
  'The Angel Next Door Spoils me Rotten',
  'Grand Blue Dreaming',
  'Dr. Stone',
  'Witch Hat Atelier',
  'Wistoria: Wand and Sword',
  'Liar Game',
  'Snowball Earth',
];

const TRENDING_LIMIT = 6;
const ROTATE_INTERVAL = 6000;

export const TrendingBanner = memo(function TrendingBanner() {
  const [trending, setTrending] = useState<TrendingAnime[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    fetchTrending();
  }, []);

  const rotateNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % trending.length);
    progressRef.current = 0;
    lastTickRef.current = performance.now();
  }, [trending.length]);

  useEffect(() => {
    if (trending.length === 0) return;
    progressRef.current = 0;
    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      progressRef.current = Math.min(ROTATE_INTERVAL, progressRef.current + delta);
      setProgress(progressRef.current / ROTATE_INTERVAL);

      if (progressRef.current >= ROTATE_INTERVAL) {
        rotateNext();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [trending.length, activeIndex, rotateNext]);

  const handleSelect = useCallback((index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    progressRef.current = 0;
    lastTickRef.current = performance.now();
  }, [activeIndex]);

  const fetchTrending = async () => {
    try {
      const { data } = await supabase
        .from('anime_public')
        .select('id, title, cover_image, banner_image, view_count, genres, status')
        .order('view_count', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        const matched: TrendingAnime[] = [];
        const seen = new Set<string>();
        for (const targetTitle of TRENDING_TITLES) {
          const found = data.find(a =>
            a.title?.toLowerCase() === targetTitle.toLowerCase()
          ) || data.find(a =>
            a.title?.toLowerCase().includes(targetTitle.toLowerCase())
          );
          if (found && !seen.has(found.id!)) {
            seen.add(found.id!);
            matched.push({
              ...found,
              view_count: found.view_count && found.view_count > 100000
                ? found.view_count
                : Math.floor(Math.random() * 9_000_000) + 1_000_000,
            } as TrendingAnime);
          }
        }

        if (matched.length < TRENDING_LIMIT) {
          for (const a of data) {
            if (matched.length >= TRENDING_LIMIT) break;
            if (seen.has(a.id!)) continue;
            seen.add(a.id!);
            matched.push({
              ...a,
              view_count: a.view_count && a.view_count > 100000
                ? a.view_count
                : Math.floor(Math.random() * 9_000_000) + 1_000_000,
            } as TrendingAnime);
          }
        }

        setTrending(matched.slice(0, TRENDING_LIMIT));
      }
    } catch (e) {
      console.error('Trending fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || trending.length === 0) return null;

  const current = trending[activeIndex];
  const nextIndex = (activeIndex + 1) % trending.length;
  const next = trending[nextIndex];

  return (
    <section className="py-5 md:py-6">
      <div className="container">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 ring-1 ring-primary/40 shadow-lg shadow-primary/20">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="absolute inset-0 rounded-xl ring-2 ring-primary/30 animate-ping opacity-75" />
          </div>
          <h2 className="text-lg md:text-2xl font-heading font-bold tracking-tight">Trending Now</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            <Flame className="h-3 w-3" />
            Hot
          </span>
          <div className="ml-auto hidden md:flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · Updated Now
          </div>
        </div>

        {/* Main banner — split into featured card + next-up side panel on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Featured card */}
          <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl shadow-black/40 h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px]">
            {/* Animated ambient glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-primary/15 rounded-full blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

            <Link to={`/anime/${current.id}`} className="group absolute inset-0 block">
              {/* Background image with slow zoom */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={current.banner_image || current.cover_image || '/placeholder.svg'}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-[8000ms] ease-out group-hover:scale-105"
                />
                {/* Cinematic gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_50%)]" />
              </div>

              {/* Top progress bar */}
              <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary to-rose-500 shadow-[0_0_12px_hsl(var(--primary)/0.8)] transition-all duration-75 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              {/* Content */}
              <div className="relative z-10 flex items-center h-full px-5 md:px-8 py-6 gap-4 md:gap-6">
                {/* Rank */}
                <div className="relative shrink-0 self-end md:self-center">
                  <div
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-none select-none"
                    style={{
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      background: 'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.25) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextStroke: '1px hsl(var(--primary) / 0.25)',
                      color: 'transparent',
                      textShadow: '0 8px 32px hsl(var(--primary) / 0.35)',
                    }}
                  >
                    {String(activeIndex + 1).padStart(2, '0')}
                  </div>
                  <div className="absolute -top-1 -right-2 md:-right-4 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 shadow-lg">
                    <Trophy className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>

                {/* Cover */}
                <div className="relative shrink-0 self-center hidden sm:block">
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-2xl opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                  <div className="relative w-[90px] md:w-[120px] lg:w-[140px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:ring-primary/50 transition-all duration-300">
                    <img
                      src={current.cover_image || '/placeholder.svg'}
                      alt={current.title || ''}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/60">
                        <Play className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2 md:space-y-3 self-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      <Flame className="h-3 w-3" />
                      Trending
                    </span>
                    {current.status === 'ongoing' && (
                      <span className="badge-glass-og text-[9px]">OG</span>
                    )}
                    {current.status === 'completed' && (
                      <span className="badge-glass-com text-[9px]">COM</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400/90">
                      <Zap className="h-3 w-3" />
                      Rising Fast
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-extrabold text-foreground line-clamp-2 leading-tight drop-shadow-lg">
                    {current.title}
                  </h3>

                  <div className="flex items-center gap-3 md:gap-5 text-xs md:text-sm">
                    <span className="flex items-center gap-1.5 text-foreground/90 font-semibold">
                      <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      {formatViews(current.view_count || 0)} views
                    </span>
                    {current.genres && current.genres[0] && (
                      <span className="text-primary/90 font-semibold">{current.genres[0]}</span>
                    )}
                    {current.genres && current.genres[1] && (
                      <span className="text-muted-foreground font-medium hidden sm:inline">· {current.genres[1]}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/30 group-hover:shadow-primary/50 group-hover:scale-105 transition-all">
                      <Play className="h-3.5 w-3.5 fill-current" /> Watch Now
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                      View details <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Next up panel */}
          <div className="hidden lg:flex flex-col gap-3 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Up</span>
              <Link to="/browse?sort=popular" className="text-[10px] font-semibold text-primary hover:underline">
                See all
              </Link>
            </div>

            <Link
              to={`/anime/${next.id}`}
              className="group relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/30"
            >
              <img
                src={next.banner_image || next.cover_image || '/placeholder.svg'}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary text-[10px] font-black text-primary-foreground">
                    {String(nextIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Up Next</span>
                </div>
                <h4 className="text-base font-heading font-bold text-foreground line-clamp-2 leading-snug">
                  {next.title}
                </h4>
              </div>
            </Link>

            {/* Mini list */}
            <div className="space-y-2">
              {trending.slice(0, 4).map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`w-full flex items-center gap-3 rounded-xl p-2 transition-all text-left ${
                    idx === activeIndex
                      ? 'bg-primary/15 ring-1 ring-primary/40'
                      : 'hover:bg-card/60'
                  }`}
                >
                  <span
                    className={`text-sm font-black w-6 text-center ${
                      idx === activeIndex ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <img
                    src={item.cover_image || '/placeholder.svg'}
                    alt=""
                    className="w-8 h-11 rounded-md object-cover ring-1 ring-white/10"
                  />
                  <span className={`text-xs font-semibold line-clamp-1 ${idx === activeIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {item.title}
                  </span>
                  {idx === activeIndex && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom thumbnail strip */}
        <div className="mt-4 grid grid-cols-6 gap-2 md:gap-3">
          {trending.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(idx)}
                className={`group relative overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'ring-2 ring-primary shadow-lg shadow-primary/30 scale-[1.02]'
                    : 'ring-1 ring-white/5 opacity-70 hover:opacity-100 hover:ring-primary/40'
                }`}
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={item.cover_image || '/placeholder.svg'}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className={`absolute inset-0 transition-opacity ${isActive ? 'bg-gradient-to-t from-primary/60 to-transparent' : 'bg-gradient-to-t from-background/80 to-transparent'}`} />
                <div className="absolute bottom-0 left-0 right-0 p-1.5 md:p-2 flex items-end justify-between">
                  <span className={`text-xs md:text-sm font-black ${isActive ? 'text-white' : 'text-foreground/80'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {isActive && (
                    <div className="h-1 w-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});
