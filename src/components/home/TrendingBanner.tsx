import { memo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Play, Eye, Flame } from 'lucide-react';

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

// Hardcoded trending titles in priority order (6 anime)
const TRENDING_TITLES = [
  "Tamon's B-side",
  'Yowayowa Sensei',
  'Marriage Toxin',
  'The Rising of the Shield Hero',
  'Eren the Southpaw',
  'Dr. Stone',
];


const TRENDING_LIMIT = 6;

export const TrendingBanner = memo(function TrendingBanner() {
  const [trending, setTrending] = useState<TrendingAnime[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, []);

  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % trending.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [trending.length]);

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

        // Fill any missing slots from top viewed so we always show 6.
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

  return (
    <section className="py-4">
      <div className="container">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/40 shadow-md shadow-primary/20">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="absolute inset-0 rounded-lg ring-2 ring-primary/30 animate-ping opacity-75" />
          </div>
          <h2 className="text-lg md:text-xl font-heading font-bold tracking-tight">Trending Now</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
            <Flame className="h-2.5 w-2.5" />
            Hot
          </span>
          <div className="ml-auto hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live · Updated Now
          </div>
        </div>

        {/* Main banner card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-background/40 to-card/60 backdrop-blur-xl shadow-2xl shadow-black/30 h-[150px] md:h-[200px]">
          {/* Glow blobs */}
          <div className="pointer-events-none absolute -top-16 -right-20 w-56 h-56 bg-primary/15 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-20 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl" />

          <div className="absolute inset-0 transition-opacity duration-150">
              <Link to={`/anime/${current.id}`} className="block h-full group">
                {/* BG image with parallax + ken-burns */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={current.banner_image || current.cover_image || '/placeholder.svg'}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/30" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
                </div>

                {/* Vertical accent stripe */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-transparent" />

                {/* Content */}
                <div className="relative z-10 flex items-center h-full pl-4 md:pl-6 pr-4 md:pr-8 gap-3 md:gap-5">
                  {/* Rank — large, gradient outlined */}
                  <div className="relative shrink-0">
                    <div
                      className="text-5xl md:text-7xl font-black select-none leading-none"
                      style={{
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextStroke: '1px hsl(var(--primary) / 0.3)',
                        color: 'transparent',
                        textShadow: '0 4px 24px hsl(var(--primary) / 0.4)',
                      }}
                    >
                      {String(activeIndex + 1).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Cover with glow ring */}
                  <div className="relative shrink-0 group/cover">
                    <div className="absolute inset-0 rounded-lg bg-primary/30 blur-xl opacity-0 group-hover:opacity-60 transition-opacity" />
                    <div className="relative w-[64px] md:w-[100px] rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:ring-primary/50 transition-all">
                      <img
                        src={current.cover_image || '/placeholder.svg'}
                        alt={current.title || ''}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50">
                          <Play className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
                    {/* Top tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 backdrop-blur-md px-1.5 md:px-2 py-0.5 text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-primary">
                        <Flame className="h-2 w-2 md:h-2.5 md:w-2.5" />
                        Trending
                      </span>
                      {current.status === 'ongoing' && (
                        <span className="badge-glass-og text-[8px]">OG</span>
                      )}
                      {current.status === 'completed' && (
                        <span className="badge-glass-com text-[8px]">COM</span>
                      )}
                    </div>

                    <h3 className="text-base md:text-2xl font-heading font-extrabold text-foreground line-clamp-1 leading-tight drop-shadow-lg">
                      {current.title}
                    </h3>

                    <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs">
                      <span className="flex items-center gap-1 text-foreground/80 font-semibold">
                        <Eye className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        {formatViews(current.view_count || 0)}
                      </span>
                      {current.genres && current.genres[0] && (
                        <span className="text-primary/90 font-semibold">{current.genres[0]}</span>
                      )}
                    </div>

                    <div className="hidden md:flex pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/30 group-hover:shadow-primary/50 group-hover:scale-105 transition-all">
                        <Play className="h-3 w-3 fill-current" /> Watch Now
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
          </div>

          {/* Slim progress bar */}
          <div
            className="absolute bottom-2 left-4 right-4 z-20 flex gap-1.5"
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
          >
            {trending.map((_, i) => (
              <div
                key={i}
                onClick={() => setActiveIndex(i)}
                role="button"
                tabIndex={0}
                style={{
                  height: '3px',
                  minHeight: '3px',
                  maxHeight: '3px',
                  flex: i === activeIndex ? 3 : 1,
                  borderRadius: '2px',
                  background: i === activeIndex
                    ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))'
                    : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
                  WebkitAppearance: 'none',
                  border: 'none',
                  outline: 'none',
                  padding: 0,
                  margin: 0,
                  boxShadow: i === activeIndex ? '0 0 10px hsl(var(--primary) / 0.6)' : 'none',
                  touchAction: 'manipulation',
                  fontSize: 0,
                  lineHeight: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
