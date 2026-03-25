import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Play, Star, TrendingUp, Sparkles, Shield, Zap, Download, Smartphone, Globe, Users, Swords, Heart, Wand2, Ghost, Laugh, Brain, ChevronRight, Clock, Monitor, Headphones, Subtitles, Film, Tv, MessageSquare, Quote, Trophy, BookOpen, Bell, Wifi, Share2, ThumbsUp, MessageCircle, Crown, Flame } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import logo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';

interface AnimePreview {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
  view_count: number | null;
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
  const [totalAnime, setTotalAnime] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres, view_count')
        .eq('is_featured', true)
        .limit(8);
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

    const fetchStats = async () => {
      const { count: animeCount } = await supabase.from('anime').select('id', { count: 'exact', head: true });
      const { count: episodeCount } = await supabase.from('episodes').select('id', { count: 'exact', head: true });
      if (animeCount) setTotalAnime(animeCount);
      if (episodeCount) setTotalEpisodes(episodeCount);
    };

    fetchFeatured();
    fetchGenreCovers();
    fetchStats();
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
    { label: 'Movies', icon: Film, path: '/browse?type=movie' },
    { label: 'TV Series', icon: Tv, path: '/browse?type=series' },
    { label: 'Popular', icon: TrendingUp, path: '/browse?sort=popular' },
    { label: 'New Releases', icon: Sparkles, path: '/latest-episodes' },
  ];

  const features = [
    { icon: Zap, title: 'Lightning Fast', desc: 'Stream any episode instantly with zero buffering. Our CDN delivers content at blazing speed worldwide.', highlight: true },
    { icon: Shield, title: '100% Ad-Free', desc: 'No ads, no popups, no interruptions. Just pure, uninterrupted anime watching experience from start to finish.', highlight: true },
    { icon: Download, title: 'Smart Downloads', desc: 'Download in 480p, 720p, or 1080p with proper episode names. Pick your quality and save for offline viewing.' },
    { icon: Smartphone, title: 'Mobile First', desc: 'Designed for phones with compact controls, gesture navigation, and picture-in-picture support.' },
    { icon: Globe, title: 'Hindi Dubbed', desc: 'Official Hindi DUB available for all anime — completely free, anytime, anywhere in the world.' },
    { icon: Users, title: 'Watch Parties', desc: 'Invite friends to watch together with real-time sync. Chat, react, and enjoy anime as a group.' },
    { icon: Headphones, title: 'Multi-Audio', desc: 'Switch between Hindi, English, and Japanese audio tracks on the fly without reloading the video.' },
    { icon: Subtitles, title: 'Subtitles Support', desc: 'Built-in subtitle support with multiple languages so you never miss a word of dialogue.' },
    { icon: Monitor, title: 'Cast & Mirror', desc: 'Cast to Chromecast, AirPlay, or any Smart TV seamlessly — no more "Access Expired" errors.' },
  ];

  const heroAnime = featuredAnime[activeIndex];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Hero background - large featured anime */}
      <div className="absolute inset-0 overflow-hidden">
        {heroAnime?.cover_image && (
          <div className="absolute inset-0 transition-opacity duration-1000">
            <img
              src={heroAnime.cover_image}
              alt=""
              className="w-full h-[70vh] object-cover object-top"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          </div>
        )}
        {!heroAnime?.cover_image && (
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)' }}
          />
        )}
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
        {/* Hero section */}
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 mt-6 sm:mt-12">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent)))',
                boxShadow: '0 0 40px hsl(var(--primary) / 0.2)',
              }}
            >
              <img src={logo} alt="AnimeSavi" className="w-10 h-10 sm:w-14 sm:h-14 object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
                <span className="text-primary">Anime</span>
                <span className="text-foreground">Savi</span>
              </h1>
              <p className="mt-3 text-muted-foreground text-sm sm:text-lg max-w-lg mx-auto leading-relaxed">
                India's #1 ad-free anime streaming platform. Watch Hindi dubbed anime for free — anytime, anywhere.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="w-full max-w-xl animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div
              className="relative group transition-all duration-300"
              style={{
                boxShadow: isFocused
                  ? '0 8px 40px hsl(var(--primary) / 0.25), 0 0 0 2px hsl(var(--primary) / 0.4)'
                  : '0 4px 30px hsl(0 0% 0% / 0.4)',
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
                className="w-full pl-12 pr-4 py-4 sm:py-5 rounded-2xl text-base sm:text-lg bg-card/90 backdrop-blur-sm text-foreground placeholder:text-muted-foreground border border-border/50 focus:outline-none transition-all duration-200"
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
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
            {quickLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.path)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-sm text-foreground/80 border border-border/40 hover:border-primary/40 hover:bg-card"
              >
                <link.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                {link.label}
              </button>
            ))}
          </div>

          {/* Featured anime carousel - bigger & better */}
          {featuredAnime.length > 0 && (
            <div className="w-full max-w-2xl mt-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                {featuredAnime.slice(0, 7).map((anime, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={anime.id}
                      onClick={() => navigate(`/anime/${anime.id}`)}
                      className="relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 cursor-pointer"
                      style={{
                        width: isActive ? '120px' : '55px',
                        height: isActive ? '170px' : '80px',
                        opacity: isActive ? 1 : 0.4,
                        transform: isActive ? 'scale(1)' : 'scale(0.95)',
                        border: isActive ? '2px solid hsl(var(--primary) / 0.7)' : '1px solid hsl(var(--border) / 0.2)',
                      }}
                    >
                      {anime.cover_image ? (
                        <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-accent" />
                      )}
                      {isActive && (
                        <div
                          className="absolute inset-x-0 bottom-0 p-2"
                          style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.9), transparent)' }}
                        >
                          <p className="text-[10px] sm:text-xs text-foreground font-semibold truncate text-center">{anime.title}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Carousel dots */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {featuredAnime.slice(0, 7).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: i === activeIndex ? '20px' : '6px',
                      height: '6px',
                      background: i === activeIndex ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl text-sm sm:text-base font-bold transition-all duration-200 hover:scale-105 bg-primary text-primary-foreground"
              style={{ boxShadow: '0 4px 24px hsl(var(--primary) / 0.4)' }}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              Start Watching
            </button>
            <button
              onClick={() => navigate('/browse')}
              className="flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-sm sm:text-base font-semibold transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-sm text-foreground border border-border/50 hover:border-primary/40"
            >
              Browse All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Stats Bar */}
        <div className="w-full max-w-3xl mx-auto mt-16 animate-fade-in" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center justify-around py-5 px-4 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/30">
            <div className="text-center">
              <p className="text-2xl sm:text-4xl font-extrabold text-primary">{totalAnime || '100'}+</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Anime Titles</p>
            </div>
            <div className="w-px h-10 bg-border/30" />
            <div className="text-center">
              <p className="text-2xl sm:text-4xl font-extrabold text-primary">{totalEpisodes || '500'}+</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Episodes</p>
            </div>
            <div className="w-px h-10 bg-border/30" />
            <div className="text-center">
              <p className="text-2xl sm:text-4xl font-extrabold text-primary">24/7</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Free Streaming</p>
            </div>
            <div className="w-px h-10 bg-border/30 hidden sm:block" />
            <div className="text-center hidden sm:block">
              <p className="text-2xl sm:text-4xl font-extrabold text-primary">0</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">Ads Ever</p>
            </div>
          </div>
        </div>

        {/* Genre Explorer Section */}
        <div className="w-full max-w-4xl mx-auto mt-20 animate-fade-in" style={{ animationDelay: '600ms' }}>
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">
              Discover
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Explore by Genre</h2>
            <p className="text-muted-foreground text-sm mt-2">Find your next favorite anime by genre</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {GENRES.map((genre) => (
              <button
                key={genre.name}
                onClick={() => navigate(`/browse?genre=${encodeURIComponent(genre.name)}`)}
                className="relative group h-28 sm:h-36 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:shadow-xl"
              >
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
                <div className={`absolute inset-0 bg-gradient-to-t ${genre.gradient} to-transparent`} />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />
                <div className="relative z-10 h-full flex flex-col items-center justify-center gap-2">
                  <genre.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-lg" />
                  <span className="text-white font-bold text-sm sm:text-base drop-shadow-lg">{genre.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Why AnimeSavi - Redesigned */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '700ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">
              Why Choose Us
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Why AnimeSavi?</h2>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-lg mx-auto">
              Built by anime fans, for anime fans. Here's what makes us different from every other streaming site.
            </p>
          </div>

          {/* Top 2 highlighted features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {features.filter(f => f.highlight).map((f) => (
              <div
                key={f.title}
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-primary/20 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--card)))',
                }}
              >
                <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: 'hsl(var(--primary))' }} />
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Remaining features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.filter(f => !f.highlight).map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300 hover:bg-card/60"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="w-full max-w-3xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '800ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">
              Simple Steps
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">How It Works</h2>
            <p className="text-muted-foreground text-sm mt-2">Start watching anime in seconds</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Search or Browse', desc: 'Find your favorite anime using search or browse by genre, popularity, or latest releases.', icon: Search },
              { step: '02', title: 'Pick an Episode', desc: 'Choose your episode, season, and preferred audio language — Hindi, English, or Japanese.', icon: Play },
              { step: '03', title: 'Watch or Download', desc: 'Stream instantly in HD or download in your preferred quality for offline viewing.', icon: Download },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="w-full max-w-4xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '850ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">
              Community
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">What Our Users Say</h2>
            <p className="text-muted-foreground text-sm mt-2">Trusted by thousands of anime fans across India</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Arjun K.', rating: 5, text: 'Best anime site in India! Hindi dubs are amazing and no ads at all. Switched from Crunchyroll and never looked back.', time: '2 weeks ago' },
              { name: 'Priya S.', rating: 5, text: 'The download feature is a lifesaver. I download episodes on WiFi and watch during my commute. Love the 1080p quality!', time: '1 month ago' },
              { name: 'Rahul M.', rating: 4, text: 'Watch parties with friends are so fun! We watch Jujutsu Kaisen together every week. Great feature.', time: '3 weeks ago' },
              { name: 'Sneha D.', rating: 5, text: 'Finally an anime site that works perfectly on my phone. Controls are smooth and video loads instantly.', time: '1 week ago' },
              { name: 'Vikram P.', rating: 5, text: 'Multi-audio switching is incredible. I can switch between Hindi and Japanese mid-episode without any buffering.', time: '2 months ago' },
              { name: 'Ananya R.', rating: 4, text: 'Clean UI, fast streaming, and the library keeps growing. This is what every anime platform should be like.', time: '1 month ago' },
            ].map((review, i) => (
              <div
                key={i}
                className="relative p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300"
              >
                <Quote className="absolute top-3 right-3 w-5 h-5 text-primary/15" />
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Star key={si} className={`w-3.5 h-3.5 ${si < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed mb-4">"{review.text}"</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{review.name}</span>
                  <span className="text-[10px] text-muted-foreground">{review.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="w-full max-w-3xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '900ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-sm mt-2">Got questions? We've got answers.</p>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {[
              { q: 'Is AnimeSavi really free?', a: 'Yes, 100% free! No subscriptions, no hidden fees, no premium plans. All anime, all episodes, completely free to watch and download.' },
              { q: 'Are there any ads on AnimeSavi?', a: 'Absolutely zero ads. No popups, no banners, no video ads before episodes. We believe anime should be enjoyed without interruptions.' },
              { q: 'Can I watch anime in Hindi?', a: 'Yes! We provide official Hindi dubbed versions of all anime. You can also switch to English or Japanese audio using the multi-audio feature.' },
              { q: 'Can I download anime for offline viewing?', a: 'Yes! You can download episodes in 480p, 720p, or 1080p quality. Downloaded anime works completely offline — no internet needed to watch.' },
              { q: 'Does AnimeSavi work on mobile?', a: 'AnimeSavi is designed mobile-first. It works perfectly on all phones with compact controls, gesture navigation, and can be installed as a PWA app on your home screen.' },
              { q: 'What is a Watch Party?', a: 'Watch Parties let you watch anime together with friends in real-time. You can sync playback, chat, and react together — even if you\'re in different locations.' },
              { q: 'How often is new anime added?', a: 'We add new episodes and series regularly. Check the Release Calendar to see upcoming releases and set reminders for your favorite shows.' },
              { q: 'Is my data safe on AnimeSavi?', a: 'We take privacy seriously. Your watch history and preferences are stored securely. We never sell user data or track you with third-party analytics.' },
            ].map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/30 rounded-xl px-4 overflow-hidden bg-card/20">
                <AccordionTrigger className="text-sm sm:text-base font-medium text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Final CTA */}
        <div className="w-full max-w-2xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '950ms' }}>
          <div className="text-center p-8 sm:p-12 rounded-3xl border border-border/30" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--card) / 0.5))' }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ready to Watch?</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 max-w-md mx-auto">
              Join thousands of anime fans streaming their favorites on AnimeSavi — completely free and ad-free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-bold transition-all duration-200 hover:scale-105 bg-primary text-primary-foreground"
                style={{ boxShadow: '0 4px 24px hsl(var(--primary) / 0.4)' }}
              >
                <Play className="w-5 h-5 fill-current" />
                Start Watching Now
              </button>
              <button
                onClick={() => navigate('/browse')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-foreground/80 hover:text-foreground"
              >
                Browse Library
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="relative z-10 pb-8 pt-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src={logo} alt="" className="w-5 h-5 rounded" />
          <span className="text-sm font-semibold">
            <span className="text-primary">Anime</span><span className="text-foreground/60">Savi</span>
          </span>
        </div>
        <p className="text-muted-foreground/40 text-xs">
          © 2026 AnimeSavi — India's ad-free anime streaming platform
        </p>
      </div>
    </div>
  );
}
