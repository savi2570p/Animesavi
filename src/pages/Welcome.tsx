import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Play, Star, TrendingUp, Sparkles, Shield, Zap, Download, Smartphone, Globe, Users, Swords, Heart, Wand2, Ghost, Laugh, Brain } from 'lucide-react';
import logo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';

interface AnimePreview {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
}

const GENRES = [
  { name: 'Action', icon: Swords, gradient: 'from-red-600/80 to-orange-600/60' },
  { name: 'Romance', icon: Heart, gradient: 'from-pink-600/80 to-rose-500/60' },
  { name: 'Fantasy', icon: Wand2, gradient: 'from-purple-600/80 to-violet-500/60' },
  { name: 'Horror', icon: Ghost, gradient: 'from-gray-800/90 to-gray-600/60' },
  { name: 'Comedy', icon: Laugh, gradient: 'from-yellow-600/80 to-amber-500/60' },
  { name: 'Sci-Fi', icon: Brain, gradient: 'from-cyan-600/80 to-blue-500/60' },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [featuredAnime, setFeaturedAnime] = useState<AnimePreview[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [genreCovers, setGenreCovers] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres')
        .eq('is_featured', true)
        .limit(6);
      if (data?.length) setFeaturedAnime(data);
    };

    const fetchGenreCovers = async () => {
      const { data } = await supabase
        .from('anime')
        .select('cover_image, genres')
        .not('cover_image', 'is', null)
        .limit(100);
      if (data) {
        const covers: Record<string, string> = {};
        for (const genre of GENRES) {
          const match = data.find(a => a.genres?.includes(genre.name) && a.cover_image);
          if (match?.cover_image) covers[genre.name] = match.cover_image;
        }
        setGenreCovers(covers);
      }
    };

    fetchFeatured();
    fetchGenreCovers();
  }, []);

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

  const features = [
    { icon: Zap, title: 'Instant Streaming', desc: 'Watch anime instantly — no buffering, no delays.' },
    { icon: Shield, title: '100% Ad-Free', desc: 'Zero ads, zero popups. Just pure anime.' },
    { icon: Download, title: 'Direct Downloads', desc: 'Download episodes with proper names instantly.' },
    { icon: Smartphone, title: 'Mobile Optimized', desc: 'Smooth experience on every device and screen.' },
    { icon: Globe, title: 'Hindi Dubbed', desc: 'Official Hindi DUB — free, anytime, anywhere.' },
    { icon: Users, title: 'Watch Parties', desc: 'Watch together with friends in real-time sync.' },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Background artwork */}
      <div className="absolute inset-0 overflow-hidden">
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
              }}
            >
              {anime.cover_image && (
                <img src={anime.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
          ))}
        </div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{ background: 'linear-gradient(to top, hsl(var(--background)), transparent)' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="AnimeSavi" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-lg font-bold">
            <span className="text-primary">Anime</span>
            <span className="text-foreground">Savi</span>
          </span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground transition-all duration-200 hover:scale-105 bg-accent border border-border"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-8 pb-16">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8 mt-8 sm:mt-16">
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
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
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
              />
              {searchQuery && (
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground bg-primary transition-all duration-200 hover:scale-105"
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 bg-secondary text-foreground/80 border border-border/50"
              >
                <link.icon className="w-4 h-4 text-primary" />
                {link.label}
              </button>
            ))}
          </div>

          {/* Featured anime carousel */}
          {featuredAnime.length > 0 && (
            <div className="w-full max-w-lg mt-2 animate-fade-in" style={{ animationDelay: '450ms' }}>
              <div className="flex items-center justify-center gap-3 overflow-hidden">
                {featuredAnime.slice(0, 5).map((anime, i) => (
                  <button
                    key={anime.id}
                    onClick={() => navigate(`/anime/${anime.id}`)}
                    className="relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 cursor-pointer"
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
                      <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-accent" />
                    )}
                    {i === activeIndex && (
                      <div
                        className="absolute inset-x-0 bottom-0 p-1.5"
                        style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.85), transparent)' }}
                      >
                        <p className="text-[10px] text-foreground font-medium truncate text-center">{anime.title}</p>
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
            className="px-8 py-3 rounded-2xl text-base font-bold transition-all duration-200 hover:scale-105 animate-fade-in bg-primary text-primary-foreground"
            style={{
              animationDelay: '600ms',
              boxShadow: '0 4px 20px hsl(var(--primary) / 0.35)',
            }}
          >
            Start Watching
          </button>
        </div>

        {/* Genre Explorer Section */}
        <div className="w-full max-w-4xl mx-auto mt-20 animate-fade-in" style={{ animationDelay: '700ms' }}>
          <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-2">Explore by Genre</h2>
          <p className="text-center text-muted-foreground text-sm mb-8">Find your next favorite anime by genre</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {GENRES.map((genre) => (
              <button
                key={genre.name}
                onClick={() => navigate(`/browse?genre=${encodeURIComponent(genre.name)}`)}
                className="relative group h-28 sm:h-36 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:shadow-xl"
              >
                {/* Background image */}
                {genreCovers[genre.name] ? (
                  <img
                    src={genreCovers[genre.name]}
                    alt={genre.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-card" />
                )}
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${genre.gradient} to-transparent`} />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />
                {/* Content */}
                <div className="relative z-10 h-full flex flex-col items-center justify-center gap-2">
                  <genre.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-lg" />
                  <span className="text-white font-bold text-sm sm:text-base drop-shadow-lg">{genre.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Features section */}
        <div className="w-full max-w-4xl mx-auto mt-20 animate-fade-in" style={{ animationDelay: '750ms' }}>
          <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-2">Why AnimeSavi?</h2>
          <p className="text-center text-muted-foreground text-sm mb-8">Everything you need for the perfect anime experience</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-center text-center p-4 rounded-2xl bg-card/50 border border-border/30 hover:border-primary/30 transition-all duration-300 hover:scale-[1.03]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="w-full max-w-2xl mx-auto mt-12 flex items-center justify-center gap-8 sm:gap-12 animate-fade-in" style={{ animationDelay: '900ms' }}>
          {[
            { value: '500+', label: 'Episodes' },
            { value: '100+', label: 'Anime Titles' },
            { value: '24/7', label: 'Streaming' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom branding */}
      <div className="relative z-10 pb-6 text-center">
        <p className="text-muted-foreground/40 text-xs">
          ©2026 AnimeSavi — Fully ad-free anime streaming
        </p>
      </div>
    </div>
  );
}
