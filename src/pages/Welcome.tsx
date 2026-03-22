import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Play, Star, TrendingUp, Sparkles } from 'lucide-react';
import logo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';

interface AnimePreview {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
}

export default function Welcome() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [featuredAnime, setFeaturedAnime] = useState<AnimePreview[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch a few featured anime for the background showcase
  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres')
        .eq('is_featured', true)
        .limit(6);
      if (data?.length) setFeaturedAnime(data);
    };
    fetchFeatured();
  }, []);

  // Rotate featured anime
  useEffect(() => {
    if (featuredAnime.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % featuredAnime.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [featuredAnime.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const quickLinks = [
    { label: 'Movies', icon: Play, path: '/browse?type=movie' },
    { label: 'TV Series', icon: Star, path: '/browse?type=series' },
    { label: 'Popular', icon: TrendingUp, path: '/browse?sort=popular' },
    { label: 'New', icon: Sparkles, path: '/latest-episodes' },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Background artwork - subtle anime covers */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating anime covers in background */}
        <div className="absolute inset-0 opacity-[0.04]">
          {featuredAnime.slice(0, 4).map((anime, i) => (
            <div
              key={anime.id}
              className="absolute rounded-2xl overflow-hidden"
              style={{
                width: '180px',
                height: '260px',
                top: `${15 + (i % 2) * 35}%`,
                right: `${5 + i * 12}%`,
                transform: `rotate(${-8 + i * 5}deg)`,
                transition: 'opacity 1s ease',
              }}
            >
              {anime.cover_image && (
                <img src={anime.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
          ))}
        </div>

        {/* Ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{
            background: 'linear-gradient(to top, hsl(var(--background)), transparent)',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AnimeSavi" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-lg font-bold font-[var(--font-heading)]">
            <span className="text-primary">Anime</span>
            <span className="text-foreground">Savi</span>
          </span>
        </div>

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground transition-all duration-200 hover:scale-105"
          style={{
            background: 'hsl(var(--accent))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </button>
      </div>

      {/* Main content - centered */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-8"
        style={{ minHeight: 'calc(100vh - 72px)' }}
      >
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8 -mt-16">
          {/* Logo + brand */}
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent)))',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <img src={logo} alt="AnimeSavi" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
            </div>

            <div className="text-center">
              <h1 className="text-3xl sm:text-5xl font-extrabold font-[var(--font-heading)] tracking-tight">
                <span className="text-primary">Anime</span>
                <span className="text-foreground">Savi</span>
              </h1>
              <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                Your go-to destination for anime streaming. Ad-free, fast, and always updated.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="w-full max-w-xl animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div
              className="relative group transition-all duration-300"
              style={{
                boxShadow: isFocused
                  ? '0 8px 40px hsl(var(--primary) / 0.2), 0 0 0 2px hsl(var(--primary) / 0.4)'
                  : '0 4px 24px hsl(0 0% 0% / 0.3)',
                borderRadius: '1rem',
              }}
            >
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200"
                style={{ color: isFocused ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
              />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Search anime, movies, series..."
                className="w-full pl-12 pr-4 py-4 sm:py-5 rounded-2xl text-base sm:text-lg bg-card text-foreground placeholder:text-muted-foreground border border-border/50 focus:outline-none transition-all duration-200"
                style={{
                  background: 'hsl(var(--card))',
                }}
              />
              {searchQuery && (
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'hsl(var(--primary))',
                  }}
                >
                  Search
                </button>
              )}
            </div>
          </form>

          {/* Quick links */}
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
            {quickLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.path)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                style={{
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--foreground) / 0.8)',
                  border: '1px solid hsl(var(--border) / 0.5)',
                }}
              >
                <link.icon className="w-4 h-4 text-primary" />
                {link.label}
              </button>
            ))}
          </div>

          {/* Featured anime carousel - small preview cards */}
          {featuredAnime.length > 0 && (
            <div className="w-full max-w-lg mt-4 animate-fade-in" style={{ animationDelay: '450ms' }}>
              <div className="flex items-center justify-center gap-3 overflow-hidden">
                {featuredAnime.slice(0, 5).map((anime, i) => (
                  <button
                    key={anime.id}
                    onClick={() => navigate(`/anime/${anime.id}`)}
                    className="relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 cursor-pointer group"
                    style={{
                      width: i === activeIndex ? '100px' : '60px',
                      height: i === activeIndex ? '140px' : '90px',
                      opacity: i === activeIndex ? 1 : 0.5,
                      transform: i === activeIndex ? 'scale(1)' : 'scale(0.9)',
                      boxShadow: i === activeIndex ? 'var(--shadow-glow)' : 'none',
                      border: i === activeIndex ? '2px solid hsl(var(--primary) / 0.6)' : '1px solid hsl(var(--border) / 0.3)',
                    }}
                  >
                    {anime.cover_image ? (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-accent" />
                    )}
                    {i === activeIndex && (
                      <div
                        className="absolute inset-x-0 bottom-0 p-1.5"
                        style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.85), transparent)' }}
                      >
                        <p className="text-[10px] text-foreground font-medium truncate text-center">
                          {anime.title}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start watching CTA */}
          <button
            onClick={() => navigate('/')}
            className="mt-2 px-8 py-3 rounded-2xl text-base font-bold transition-all duration-200 hover:scale-105 animate-fade-in"
            style={{
              animationDelay: '600ms',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              boxShadow: '0 4px 20px hsl(var(--primary) / 0.35)',
            }}
          >
            Start Watching
          </button>
        </div>
      </div>

      {/* Bottom subtle branding */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <p className="text-muted-foreground/40 text-xs">
          ©2026 AnimeSavi — Fully ad free anime streaming
        </p>
      </div>
    </div>
  );
}
