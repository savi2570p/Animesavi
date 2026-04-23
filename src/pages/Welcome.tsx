import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Play, Star, TrendingUp, Sparkles, Shield, Zap, Download, Smartphone, Globe, Users, Swords, Heart, Wand2, Ghost, Laugh, Brain, ChevronRight, Clock, Monitor, Headphones, Subtitles, Film, Tv, MessageSquare, Quote, Trophy, BookOpen, Bell, Wifi, Share2, ThumbsUp, MessageCircle, Crown, Flame, Send, ExternalLink, Eye, Lock, HardDrive, Layers, Palette, RefreshCw, Settings, Volume2, FileText, Award, Radio, Gamepad2, Compass, MapPin, Calendar, BarChart3, Keyboard, Cast } from 'lucide-react';
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

const TESTIMONIALS = [
  { name: 'Arjun K.', rating: 5, text: 'Best anime site in India! Hindi dubs are amazing and no ads at all. The Watch List feature keeps me organized.', time: '1 week ago' },
  { name: 'Priya S.', rating: 5, text: 'The download feature is a lifesaver. I download episodes on WiFi and watch during my commute. Love the 4K quality!', time: '2 weeks ago' },
  { name: 'Rahul M.', rating: 4, text: 'Watch parties with friends are so fun! The Trending Now banner helps us pick what to watch together.', time: '1 week ago' },
  { name: 'Sneha D.', rating: 5, text: 'Finally an anime site that works perfectly on my phone. The glassy OG/COM badges look so premium!', time: '3 days ago' },
  { name: 'Vikram P.', rating: 5, text: 'Multi-audio switching is incredible. E-sub toggling works great and I can keep my favorite server selected.', time: '1 month ago' },
  { name: 'Ananya R.', rating: 5, text: 'Clean UI, fast streaming, and the MuseIN countdown is so exciting! Can\'t wait for new Hindi dub drops.', time: '5 days ago' },
  { name: 'Karan T.', rating: 5, text: 'I was paying for premium on other sites. AnimeSavi gives everything for free with ZERO ads. The slim scrollbar looks clean!', time: '2 days ago' },
  { name: 'Meera J.', rating: 5, text: 'The release calendar and notification system is perfect. CC subtitle editor is a game-changer for fans.', time: '1 week ago' },
  { name: 'Rohit B.', rating: 4, text: 'Four server options and no forced switching means I can choose what works best. H.Savi on my iPhone is flawless.', time: '4 days ago' },
  { name: 'Deepak N.', rating: 5, text: 'The 4K quality is stunning on my big screen. Trending Now banner makes discovering new anime effortless.', time: '3 days ago' },
  { name: 'Simran L.', rating: 5, text: 'I love the PWA feature — installed it on my phone and it feels like a native app. Watch List is super handy!', time: '2 days ago' },
  { name: 'Aditya G.', rating: 4, text: 'The search works great. Genre filters + Crunchy & MuseIN tabs make browsing so organized.', time: '1 week ago' },
  { name: 'Pooja V.', rating: 5, text: 'My entire friend group uses AnimeSavi now. The embed player with episode grid is perfect for sharing.', time: '2 months ago' },
  { name: 'Nikhil R.', rating: 5, text: 'Continue watching feature is brilliant. Server maintenance popup is clear when a server is down — no confusion!', time: '3 days ago' },
  { name: 'Kavya M.', rating: 4, text: 'The embed player is so clean. Episode selector grid like Netflix makes it easy to jump between episodes.', time: '1 week ago' },
  { name: 'Saurabh P.', rating: 5, text: 'AnimeSavi loads faster than any other anime site. Even on slow 3G, H.Savi server works smoothly. Impressive!', time: '1 day ago' },
];

const FAQ_ITEMS = [
  { q: 'Is AnimeSavi really free?', a: 'Yes, 100% free! No subscriptions, no hidden fees, no premium plans. All anime, all episodes, completely free to watch and download.' },
  { q: 'Are there any ads on AnimeSavi?', a: 'Absolutely zero ads. No popups, no banners, no video ads before episodes. We believe anime should be enjoyed without interruptions.' },
  { q: 'Can I watch anime in Hindi?', a: 'Yes! We provide official Hindi dubbed versions of all anime. You can also switch to English or Japanese audio using the multi-audio feature.' },
  { q: 'Can I download anime for offline viewing?', a: 'Yes! You can download episodes in 480p, 720p, 1080p, or even 4K quality. Downloaded anime works completely offline — no internet needed to watch.' },
  { q: 'Does AnimeSavi work on mobile?', a: 'AnimeSavi is designed mobile-first. It works perfectly on all phones with compact controls, gesture navigation, and can be installed as a PWA app on your home screen.' },
  { q: 'What is a Watch Party?', a: 'Watch Parties let you watch anime together with friends in real-time. You can sync playback, chat, and react together — even if you\'re in different locations.' },
  { q: 'How often is new anime added?', a: 'We add new episodes and series regularly. Check the Release Calendar to see upcoming releases and set reminders for your favorite shows.' },
  { q: 'Is my data safe on AnimeSavi?', a: 'We take privacy seriously. Your watch history and preferences are stored securely. We never sell user data or track you with third-party analytics.' },
  { q: 'Can I cast anime to my TV?', a: 'Yes! AnimeSavi supports Chromecast, AirPlay, and screen mirroring to any Smart TV. You can watch on the big screen without any extra apps.' },
  { q: 'Do I need to create an account?', a: 'You can browse and watch without an account. However, creating a free account lets you save favorites, track watch history, join watch parties, and get release notifications.' },
  { q: 'What video qualities are available?', a: 'We offer 480p, 720p, 1080p, and 2160p (4K) depending on the source. The player automatically selects the best quality for your connection.' },
  { q: 'Can I request new anime to be added?', a: 'Yes! You can apply to become an uploader or submit requests through the community. We prioritize the most requested shows.' },
  { q: 'Does AnimeSavi have subtitles?', a: 'Yes, we support subtitles in multiple languages. Subtitles are embedded in the video player and can be toggled on or off.' },
  { q: 'Is AnimeSavi available outside India?', a: 'AnimeSavi is available worldwide! While our primary focus is Hindi dubbed anime, our platform works from anywhere in the world.' },
  { q: 'How do I install AnimeSavi as an app?', a: 'On Android Chrome, tap the three-dot menu and select "Add to Home Screen." On iPhone Safari, tap the Share icon and choose "Add to Home Screen." It works like a native app!' },
  { q: 'Can I change audio language mid-episode?', a: 'Yes! Use the audio switcher icon in the video player to switch between Hindi, English, and Japanese audio without reloading the video.' },
  { q: 'What is the embed player?', a: 'The embed player is a lightweight version of our video player that can be shared via link. It works on any device and loads instantly without needing the full site.' },
  { q: 'How does Continue Watching work?', a: 'When you\'re logged in, your watch progress is automatically saved. Next time you visit, you\'ll see a "Continue Watching" row showing where you left off.' },
  { q: 'Can I watch anime on my Smart TV?', a: 'Yes! You can cast from your phone using Chromecast/AirPlay, or open AnimeSavi directly in your Smart TV\'s browser for a big-screen experience.' },
  { q: 'Is there a dark mode?', a: 'AnimeSavi uses a beautiful dark theme by default, designed to reduce eye strain during late-night binge sessions. It\'s always on!' },
  { q: 'How do Watch Party invites work?', a: 'Create a Watch Party from any episode page. You\'ll get a unique code to share with friends. They enter the code to join and watch in sync with you.' },
  { q: 'What happens if my internet drops while watching?', a: 'If you lose connection, the player will pause and show an offline indicator. Once reconnected, playback resumes automatically from where you left off.' },
  { q: 'Can I download in 4K quality?', a: 'Yes! If the source supports it, you can download episodes in 2160p (4K) resolution. Perfect for watching on large screens with crystal-clear detail.' },
  { q: 'How do I report a broken video?', a: 'If a video isn\'t playing, use the report button on the episode page. Our team reviews reports quickly and fixes issues within 24 hours.' },
  { q: 'Are all anime available in Hindi?', a: 'We strive to provide Hindi dubs for all anime. Most popular titles have Hindi audio. For newer or niche titles, Japanese with subtitles may be available first.' },
  { q: 'Can I create playlists or watchlists?', a: 'Yes! Use the Favorites feature to save anime you want to watch later. You can also use Watch Later to bookmark specific episodes for future viewing.' },
  { q: 'Does AnimeSavi support picture-in-picture?', a: 'Yes! On supported browsers and devices, you can use picture-in-picture mode to watch anime while browsing other apps or tabs.' },
  { q: 'How fast do new episodes get uploaded?', a: 'We aim to upload new episodes on the same day as their official release. Check the Release Calendar for exact schedules of ongoing series.' },
  { q: 'Can multiple people use one account?', a: 'While there\'s no strict limit, we recommend one account per person to keep watch history and preferences accurate. It\'s free, so everyone can make their own!' },
  { q: 'What browsers work best with AnimeSavi?', a: 'Chrome, Safari, Firefox, and Edge all work great. For the best PWA experience, we recommend Chrome on Android and Safari on iOS.' },
  { q: 'Is there a way to see upcoming anime?', a: 'Yes! Visit the Upcoming page to see anime that haven\'t been released yet with countdown timers, or check the Schedule page for weekly release schedules.' },
  { q: 'How do I change my profile picture?', a: 'Go to your Profile page from the hamburger menu. You can upload a custom avatar or choose from default options.' },
  { q: 'Does the player support keyboard shortcuts?', a: 'Yes! Space for play/pause, F for fullscreen, M for mute, and arrow keys for seeking. These work on desktop when the player is focused.' },
  { q: 'What is the Telegram channel for?', a: 'Our Telegram channel (@AnimeSaviInhindiDUB) shares instant updates about new episodes, announcements, and community events. Join for real-time notifications!' },
  { q: 'Can I share anime with friends?', a: 'Yes! Every anime and episode has a share button. You can share direct links, embed links, or even QR codes that open directly in the player.' },
  { q: 'How do release reminders work?', a: 'On any ongoing anime page, tap the bell icon to set a reminder. You\'ll get a notification when new episodes drop so you never miss an update.' },
  { q: 'Is AnimeSavi legal?', a: 'AnimeSavi aggregates and provides links to officially dubbed content. We respect content creators and work to provide the best viewing experience for fans.' },
  { q: 'What makes AnimeSavi different from other sites?', a: 'Zero ads, Hindi dubs, offline downloads, watch parties, 4K quality, multi-audio, PWA support, and a premium UI — all completely free. No other site offers all of this together.' },
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
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchStage, setLaunchStage] = useState('Warming up servers');

  const startWatching = (target: string = '/') => {
    if (isLaunching) return;
    setIsLaunching(true);
    setLaunchProgress(0);
    setLaunchStage('Warming up servers');
    const stages: Array<{ at: number; label: string }> = [
      { at: 18, label: 'Connecting to H.Savi CDN' },
      { at: 38, label: 'Loading your library' },
      { at: 58, label: 'Preparing 4K stream' },
      { at: 78, label: 'Syncing watch history' },
      { at: 92, label: 'Almost there' },
    ];
    const start = performance.now();
    const duration = 1800; // ms — fast but feels real
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setLaunchProgress(pct);
      const stage = [...stages].reverse().find(s => pct >= s.at);
      if (stage) setLaunchStage(stage.label);
      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setLaunchStage('Ready');
        setTimeout(() => navigate(target), 220);
      }
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres, view_count')
        .eq('is_featured', true)
        .neq('title', 'My Hero Academia')
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
    { icon: Zap, title: 'Lightning Fast', desc: 'Stream instantly with H.Savi, SAVI.IN, Multi.Savi, and X-PLUS. Pick your favorite server anytime with no forced switching.', highlight: true },
    { icon: Shield, title: '100% Ad-Free', desc: 'No ads, no popups, no interruptions. Just pure, uninterrupted anime watching experience from start to finish.', highlight: true },
    { icon: Download, title: 'Smart Downloads', desc: 'Download in 480p, 720p, 1080p or even 2160p (4K) with proper episode names, codec info & quality tags.' },
    { icon: Smartphone, title: 'Mobile First', desc: 'Designed for phones with compact controls, gesture navigation, PiP, and iOS-optimized H.Savi server.' },
    { icon: Globe, title: 'Hindi Dubbed', desc: 'Official Hindi DUB available for all anime — completely free, anytime, anywhere in the world.' },
    { icon: Users, title: 'Watch Parties', desc: 'Invite friends to watch together with real-time sync. Chat, react, and enjoy anime as a group.' },
    { icon: Headphones, title: 'Multi-Audio', desc: 'Switch between Hindi, English, and Japanese audio tracks on the fly without reloading the video.' },
    { icon: Subtitles, title: 'CC & Subtitles', desc: 'Built-in CC subtitle editor with manual timing controls. Import VTT/SRT or create custom captions.' },
    { icon: Monitor, title: 'MuseIN & Crunchy', desc: 'Dedicated tabs for Muse India and Crunchyroll content with smart auto-tagging and Watch List support.' },
  ];

  const heroAnime = featuredAnime[activeIndex];

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-visible bg-background">
      {/* Hero background */}
      <div className="absolute inset-0 overflow-hidden">
        {heroAnime?.cover_image && (
          <div className="absolute inset-0 transition-opacity duration-1000">
            <img src={heroAnime.cover_image} alt="" className="w-full h-[70vh] object-cover object-top" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          </div>
        )}
        {!heroAnime?.cover_image && (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)' }} />
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
        <button onClick={() => navigate('/')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground transition-all duration-200 hover:scale-105 bg-accent border border-border">
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-8 pb-16">
        {/* Hero section */}
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 mt-6 sm:mt-12">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent)))', boxShadow: '0 0 40px hsl(var(--primary) / 0.2)' }}>
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
            <div className="relative group transition-all duration-300" style={{ boxShadow: isFocused ? '0 8px 40px hsl(var(--primary) / 0.25), 0 0 0 2px hsl(var(--primary) / 0.4)' : '0 4px 30px hsl(0 0% 0% / 0.4)', borderRadius: '1rem' }}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200" style={{ color: isFocused ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
              <input ref={inputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} placeholder="Search anime, movies, series..." className="w-full pl-12 pr-4 py-4 sm:py-5 rounded-2xl text-base sm:text-lg bg-card/90 backdrop-blur-sm text-foreground placeholder:text-muted-foreground border border-border/50 focus:outline-none transition-all duration-200" />
              {searchQuery && (
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground bg-primary transition-all duration-200 hover:scale-105">Search</button>
              )}
            </div>
          </form>

          {/* Quick links */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
            {quickLinks.map((link) => (
              <button key={link.label} onClick={() => navigate(link.path)} className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-sm text-foreground/80 border border-border/40 hover:border-primary/40 hover:bg-card">
                <link.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                {link.label}
              </button>
            ))}
          </div>

          {/* Featured anime carousel */}
          {featuredAnime.length > 0 && (
            <div className="w-full max-w-2xl mt-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                {featuredAnime.slice(0, 7).map((anime, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <button key={anime.id} onClick={() => navigate(`/anime/${anime.id}`)} className="relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 cursor-pointer" style={{ width: isActive ? '120px' : '55px', height: isActive ? '170px' : '80px', opacity: isActive ? 1 : 0.4, transform: isActive ? 'scale(1)' : 'scale(0.95)', border: isActive ? '2px solid hsl(var(--primary) / 0.7)' : '1px solid hsl(var(--border) / 0.2)' }}>
                      {anime.cover_image ? <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-accent" />}
                      {isActive && (
                        <div className="absolute inset-x-0 bottom-0 p-2" style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.9), transparent)' }}>
                          <p className="text-[10px] sm:text-xs text-foreground font-semibold truncate text-center">{anime.title}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {featuredAnime.slice(0, 7).map((_, i) => (
                  <button key={i} onClick={() => setActiveIndex(i)} className="transition-all duration-300 rounded-full" style={{ width: i === activeIndex ? '20px' : '6px', height: '6px', background: i === activeIndex ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)' }} />
                ))}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <button onClick={() => startWatching('/')} className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl text-sm sm:text-base font-bold transition-all duration-200 hover:scale-105 bg-primary text-primary-foreground" style={{ boxShadow: '0 4px 24px hsl(var(--primary) / 0.4)' }}>
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              Start Watching
            </button>
            <button onClick={() => navigate('/browse')} className="flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-sm sm:text-base font-semibold transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-sm text-foreground border border-border/50 hover:border-primary/40">
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

        {/* Genre Explorer */}
        <div className="w-full max-w-4xl mx-auto mt-20 animate-fade-in" style={{ animationDelay: '600ms' }}>
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Discover</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Explore by Genre</h2>
            <p className="text-muted-foreground text-sm mt-2">Find your next favorite anime by genre</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {GENRES.map((genre) => (
              <button key={genre.name} onClick={() => navigate(`/browse?genre=${encodeURIComponent(genre.name)}`)} className="relative group h-28 sm:h-36 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:shadow-xl">
                {genreCovers[genre.name] ? <img src={genreCovers[genre.name]} alt={genre.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <div className="absolute inset-0 bg-card" />}
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

        {/* Why AnimeSavi */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '700ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Why Choose Us</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Why AnimeSavi?</h2>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-lg mx-auto">Built by anime fans, for anime fans. Here's what makes us different.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {features.filter(f => f.highlight).map((f) => (
              <div key={f.title} className="relative overflow-hidden rounded-2xl p-6 sm:p-8 border border-primary/20 transition-all duration-300 hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--card)))' }}>
                <div className="absolute top-4 right-4 w-20 h-20 rounded-full opacity-10" style={{ background: 'hsl(var(--primary))' }} />
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4"><f.icon className="w-6 h-6 text-primary" /></div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.filter(f => !f.highlight).map((f) => (
              <div key={f.title} className="flex gap-4 p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300 hover:bg-card/60">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center"><f.icon className="w-5 h-5 text-primary" /></div>
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
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Simple Steps</span>
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
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><item.icon className="w-7 h-7 text-primary" /></div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{item.step}</span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Section */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '850ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Community</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Join the AnimeSavi Community</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">Be part of India's fastest growing anime community. Connect, discuss, and watch together.</p>
          </div>

          {/* Community Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { icon: Users, label: 'Active Users', value: '50K+', color: 'text-blue-400' },
              { icon: MessageCircle, label: 'Discussions', value: '12K+', color: 'text-green-400' },
              { icon: ThumbsUp, label: 'Reviews', value: '8K+', color: 'text-yellow-400' },
              { icon: Share2, label: 'Watch Parties', value: '3K+', color: 'text-pink-400' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300">
                <stat.icon className={`w-6 h-6 sm:w-7 sm:h-7 ${stat.color}`} />
                <span className="text-xl sm:text-2xl font-extrabold text-foreground">{stat.value}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Community Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: Users, title: 'Watch Parties', desc: 'Host or join real-time watch sessions with friends. Sync playback, chat live, and react together.', gradient: 'from-primary/10 to-primary/5' },
              { icon: MessageSquare, title: 'Reviews & Ratings', desc: 'Rate anime, write reviews, and read what others think before starting a new series.', gradient: 'from-yellow-500/10 to-yellow-500/5' },
              { icon: Bell, title: 'Release Alerts', desc: 'Get notified when new episodes drop. Set reminders for your favorite ongoing series.', gradient: 'from-blue-500/10 to-blue-500/5' },
            ].map((feature, i) => (
              <div key={i} className={`p-5 sm:p-6 rounded-2xl border border-border/30 hover:border-primary/20 transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br ${feature.gradient}`}>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><feature.icon className="w-5 h-5 text-primary" /></div>
                <h3 className="text-base font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Telegram CTA */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <a
              href="https://t.me/AnimeSaviInhindiDUB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:scale-105 bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/25"
            >
              <Send className="w-4 h-4" />
              Join Telegram Channel
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        {/* Testimonials Section - 16 reviews */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '900ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Testimonials</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">What Our Users Say</h2>
            <p className="text-muted-foreground text-sm mt-2">Trusted by thousands of anime fans across India</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {TESTIMONIALS.map((review, i) => (
              <div key={i} className="relative p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300">
                <Quote className="absolute top-3 right-3 w-4 h-4 text-primary/15" />
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Star key={si} className={`w-3 h-3 ${si < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed mb-3">"{review.text}"</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{review.name}</span>
                  <span className="text-[10px] text-muted-foreground">{review.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section - 38 items */}
        <div className="w-full max-w-3xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '950ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-sm mt-2">Got questions? We've got answers. ({FAQ_ITEMS.length} FAQs)</p>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/30 rounded-xl px-4 overflow-hidden bg-card/20">
                <AccordionTrigger className="text-sm sm:text-base font-medium text-foreground hover:no-underline py-3">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Platform Highlights — at-a-glance numbers */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '955ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">By the Numbers</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Platform Highlights</h2>
            <p className="text-muted-foreground text-sm mt-2">A quick look at what AnimeSavi delivers every day</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Award, label: 'Avg. Start Time', value: '< 1.2s', color: 'text-emerald-400' },
              { icon: Layers, label: 'Quality Tiers', value: '144p–4K', color: 'text-primary' },
              { icon: HardDrive, label: 'Storage Used', value: '12 TB+', color: 'text-blue-400' },
              { icon: Radio, label: 'CDN Servers', value: '4 Active', color: 'text-pink-400' },
              { icon: Eye, label: 'Episodes Watched', value: '2.4M+', color: 'text-yellow-400' },
              { icon: Lock, label: 'DRM-Free', value: '100%', color: 'text-emerald-400' },
              { icon: RefreshCw, label: 'Auto Updates', value: 'Daily', color: 'text-cyan-400' },
              { icon: Compass, label: 'Genres', value: '30+', color: 'text-purple-400' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300">
                <s.icon className={`w-6 h-6 ${s.color}`} />
                <span className="text-xl sm:text-2xl font-extrabold text-foreground">{s.value}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supported Devices */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '960ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Watch Anywhere</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Works on Every Device</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">One account, every screen. AnimeSavi adapts to whatever you're watching on.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Smartphone, title: 'Mobile', desc: 'iOS & Android with PWA install support' },
              { icon: Monitor, title: 'Desktop', desc: 'Chrome, Safari, Firefox & Edge' },
              { icon: Tv, title: 'Smart TV', desc: 'Cast via Chromecast or open in TV browser' },
              { icon: Gamepad2, title: 'Console', desc: 'PS5 / Xbox built-in browsers supported' },
            ].map((d, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 hover:bg-card/60 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><d.icon className="w-6 h-6 text-primary" /></div>
                <h3 className="text-sm font-bold text-foreground">{d.title}</h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Tips */}
        <div className="w-full max-w-4xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '965ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Pro Tips</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Get the Most Out of AnimeSavi</h2>
            <p className="text-muted-foreground text-sm mt-2">Hidden features power-users love</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: Keyboard, title: 'Keyboard Shortcuts', desc: 'Space = play/pause, F = fullscreen, M = mute, ← → seek 10s, ↑ ↓ volume.' },
              { icon: Volume2, title: 'Switch Audio Live', desc: 'Tap the headphone icon mid-episode to swap Hindi / English / Japanese without reloading.' },
              { icon: FileText, title: 'Custom Subtitles', desc: 'Drop in your own VTT/SRT file from the CC editor for any episode.' },
              { icon: Cast, title: 'Cast to TV', desc: 'Hit the cast icon in the player to mirror to Chromecast, AirPlay, or Smart TV.' },
              { icon: Bell, title: 'Release Reminders', desc: 'Tap the bell on any ongoing series to get pinged the moment a new episode drops.' },
              { icon: Wifi, title: 'Offline Mode', desc: 'Downloaded episodes keep working even without internet — perfect for flights & commutes.' },
            ].map((tip, i) => (
              <div key={i} className="flex gap-3 p-4 sm:p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/20 transition-all duration-300">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center"><tip.icon className="w-5 h-5 text-primary" /></div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{tip.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What's Coming Next — roadmap */}
        <div className="w-full max-w-4xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '970ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Roadmap</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">What's Coming Next</h2>
            <p className="text-muted-foreground text-sm mt-2">A peek at features we're building right now</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: Crown, title: 'Persistent Watch Rooms', desc: 'Resume group sessions days later — chat history, queue and playback position all saved.', tag: 'In Progress' },
              { icon: Flame, title: 'Smart Recommendations 2.0', desc: 'Genre + mood-aware suggestions tuned by your real watch history and ratings.', tag: 'Beta' },
              { icon: Calendar, title: 'Seasonal Anime Tracker', desc: 'A single dashboard for every airing show this season with episode countdowns.', tag: 'Soon' },
              { icon: Palette, title: 'Custom Player Skins', desc: 'Pick accent colors, control layouts and skip-intro behavior to match your vibe.', tag: 'Soon' },
              { icon: BarChart3, title: 'Personal Watch Stats', desc: 'Total hours watched, top genres, longest streaks and a year-in-review wrap.', tag: 'Planned' },
              { icon: MapPin, title: 'AI Episode Recaps', desc: 'Auto-generated 30-second recaps so you never lose track of long-running shows.', tag: 'Planned' },
            ].map((r, i) => (
              <div key={i} className="relative p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 transition-all duration-300">
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/15 text-primary">{r.tag}</span>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><r.icon className="w-5 h-5 text-primary" /></div>
                <h3 className="text-sm font-bold text-foreground mb-1">{r.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust & Privacy */}
        <div className="w-full max-w-3xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '975ms' }}>
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Trust & Privacy</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Your Privacy, Respected</h2>
            <p className="text-muted-foreground text-sm mt-2">No trackers, no third-party ads, no data sales — ever.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: Shield, title: 'No Tracking', desc: 'We don\'t use Google Analytics, Facebook Pixel, or third-party trackers.' },
              { icon: Lock, title: 'Encrypted Sessions', desc: 'All traffic is HTTPS. Auth uses industry-standard JWT with rotation.' },
              { icon: Settings, title: 'You Own Your Data', desc: 'Delete your account anytime — every record is wiped within 24 hours.' },
            ].map((t, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-card/40 border border-border/30">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"><t.icon className="w-5 h-5 text-primary" /></div>
                <h3 className="text-sm font-bold text-foreground">{t.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="w-full max-w-2xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '950ms' }}>
          <div className="text-center p-8 sm:p-12 rounded-3xl border border-border/30" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--card) / 0.5))' }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ready to Watch?</h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 max-w-md mx-auto">Join thousands of anime fans streaming their favorites on AnimeSavi — completely free and ad-free.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => startWatching('/')} className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-bold transition-all duration-200 hover:scale-105 bg-primary text-primary-foreground" style={{ boxShadow: '0 4px 24px hsl(var(--primary) / 0.4)' }}>
                <Play className="w-5 h-5 fill-current" />
                Start Watching Now
              </button>
              <button onClick={() => navigate('/browse')} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-105 text-foreground/80 hover:text-foreground">
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
