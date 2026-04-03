import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Play, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export function TrendingBanner() {
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
        .limit(3);

      if (data && data.length > 0) {
        const withViews = data.map((a) => ({
          ...a,
          view_count: a.view_count && a.view_count > 100000
            ? a.view_count
            : Math.floor(Math.random() * 9_000_000) + 1_000_000,
        }));
        setTrending(withViews as TrendingAnime[]);
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
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
          <h2 className="text-lg md:text-xl font-heading font-bold">Trending Now</h2>
          <span className="badge-glass-new text-[9px] px-2 py-0.5">🔥 HOT</span>
        </div>

        <div className="relative overflow-hidden rounded-xl h-[140px] md:h-[180px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <Link to={`/anime/${current.id}`} className="block h-full group">
                {/* BG image */}
                <div className="absolute inset-0">
                  <img
                    src={current.banner_image || current.cover_image || '/placeholder.svg'}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex items-center h-full px-5 md:px-8 gap-4 md:gap-6">
                  {/* Rank */}
                  <div className="text-4xl md:text-6xl font-black text-primary/80 select-none shrink-0 drop-shadow-lg" style={{ fontFamily: 'system-ui' }}>
                    #{activeIndex + 1}
                  </div>

                  {/* Cover */}
                  <div className="shrink-0 w-[70px] md:w-[90px] rounded-lg overflow-hidden shadow-2xl border border-white/10">
                    <img
                      src={current.cover_image || '/placeholder.svg'}
                      alt={current.title || ''}
                      className="w-full aspect-[3/4] object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-xl font-bold text-white line-clamp-1 drop-shadow-lg">
                      {current.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-white/70">
                        <Eye className="h-3.5 w-3.5" />
                        {formatViews(current.view_count || 0)} views
                      </span>
                      {current.genres && current.genres[0] && (
                        <span className="text-xs text-primary/90">{current.genres[0]}</span>
                      )}
                      {current.status === 'ongoing' && (
                        <span className="badge-glass-og text-[8px]">OG</span>
                      )}
                      {current.status === 'completed' && (
                        <span className="badge-glass-com text-[8px]">COM</span>
                      )}
                    </div>
                    <div className="mt-2.5 hidden md:flex">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/90 text-white group-hover:bg-primary transition-colors">
                        <Play className="h-3 w-3 fill-current" /> Watch Now
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>

          {/* Slim indicator bars */}
          <div className="absolute bottom-2.5 right-4 z-20 flex gap-1">
            {trending.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-[3px] rounded-full transition-all duration-400 ease-in-out ${
                  i === activeIndex ? 'bg-primary w-6' : 'bg-white/30 w-3 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
