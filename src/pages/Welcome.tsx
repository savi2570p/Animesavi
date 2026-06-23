import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Play, Star, TrendingUp, Sparkles, Shield, Zap, Download, Smartphone, Globe, Users, Swords, Heart, Wand2, Ghost, Laugh, Brain, ChevronRight, Clock, Monitor, Headphones, Film, Tv, MessageSquare, Quote, Trophy, BookOpen, Bell, Wifi, Share2, ThumbsUp, MessageCircle, Crown, Flame, Send, ExternalLink, Eye, Lock, HardDrive, Layers, Palette, RefreshCw, Settings, Volume2, Award, Radio, Gamepad2, Compass, MapPin, Calendar, BarChart3, Keyboard, Cast } from 'lucide-react';
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
  { name: 'Meera J.', rating: 5, text: 'The release calendar and notification system is perfect. The reminders are a game-changer for fans.', time: '1 week ago' },
  { name: 'Rohit B.', rating: 4, text: 'Four server options and no forced switching means I can choose what works best. H.Savi on my iPhone is flawless.', time: '4 days ago' },
  { name: 'Deepak N.', rating: 5, text: 'The 4K quality is stunning on my big screen. Trending Now banner makes discovering new anime effortless.', time: '3 days ago' },
  { name: 'Simran L.', rating: 5, text: 'I love the PWA feature — installed it on my phone and it feels like a native app. Watch List is super handy!', time: '2 days ago' },
  { name: 'Aditya G.', rating: 4, text: 'The search works great. Genre filters + Crunchy & MuseIN tabs make browsing so organized.', time: '1 week ago' },
  { name: 'Pooja V.', rating: 5, text: 'My entire friend group uses AnimeSavi now. The embed player with episode grid is perfect for sharing.', time: '2 months ago' },
  { name: 'Nikhil R.', rating: 5, text: 'Continue watching feature is brilliant. Server maintenance popup is clear when a server is down — no confusion!', time: '3 days ago' },
  { name: 'Kavya M.', rating: 4, text: 'The embed player is so clean. Episode selector grid like Netflix makes it easy to jump between episodes.', time: '1 week ago' },
  { name: 'Saurabh P.', rating: 5, text: 'AnimeSavi loads faster than any other anime site. Even on slow 3G, H.Savi server works smoothly. Impressive!', time: '1 day ago' },
  { name: 'Tanvi A.', rating: 5, text: 'PIN Lock on my profile is such a thoughtful feature — my little brother can\'t mess with my watch history anymore!', time: '6 hours ago' },
  { name: 'Harsh K.', rating: 5, text: 'The 12 player themes are awesome. Rose-Gold + 4K + Hindi DUB — feels truly premium without paying a single rupee.', time: '12 hours ago' },
  { name: 'Ishaan B.', rating: 5, text: 'Up to 5 profiles per family account. My mom, dad and I each have our own continue-watching. Best UX I\'ve seen.', time: '2 days ago' },
  { name: 'Ritika S.', rating: 4, text: 'Watch parties + chat are wild fun. The new compact Telegram popup doesn\'t cover the video anymore — perfect.', time: '4 days ago' },
];

const FAQ_ITEMS = [
  { q: 'Is AnimeSavi free and ad-free?', a: 'Yes — AnimeSavi is 100% free with zero ads, no popups, and no premium plans. Every episode and feature is unlocked for everyone.' },
  { q: 'Do you have Hindi dubbed anime?', a: 'Yes. Most titles ship with official Hindi dubs, and you can switch to English or Japanese audio mid-episode using the multi-audio button in the player.' },
  { q: 'Can I download episodes for offline viewing?', a: 'Yes. Tap the download button on any episode to save it in 480p, 720p, 1080p or 4K. Downloads play offline from the Downloads page — no internet required.' },
  { q: 'How do Watch Parties work?', a: 'Open any episode, start a Watch Party, and share the code with friends. Playback stays in sync and you can chat together in real time.' },
  { q: 'Do I need an account to watch?', a: 'No, browsing and watching are open to everyone. Creating a free account unlocks Watch List, Continue Watching, favorites, and release reminders.' },
  { q: 'Can I install AnimeSavi as an app?', a: 'Yes. On Android Chrome use "Add to Home Screen" from the menu; on iPhone Safari tap Share → "Add to Home Screen". It runs like a native app with PWA support.' },
  { q: 'Why are there multiple servers?', a: 'We offer H.Savi, Multi.Savi and X-PLUS so you can pick whatever streams best on your device. Your last choice is remembered — no forced switching.' },
  { q: 'How do I report a broken episode?', a: 'Use the ⚠️ report button on the watch page or message us on Telegram @Lv_Savi. Reports are reviewed quickly and broken links are usually fixed within 24 hours.' },
  { q: 'What is the PIN Lock feature?', a: 'From Profile → Settings, enable a 4 or 6 digit PIN. Every time you reopen the site, you\'ll need to enter the PIN before accessing your account. You can change or disable it anytime.' },
  { q: 'How many profiles can a single account have?', a: 'Up to 5 profiles per regular account, and 9 for admins/uploaders. Each profile keeps its own watch history, watch list, favorites and recommendations.' },
  { q: 'Does the player support 4K and multi-audio?', a: 'Yes — 4K UHD playback is enabled site-wide. The player exposes every available audio track reported by the source manifest, with a one-tap switcher.' },
  { q: 'Can I customize the video player look?', a: 'Yes. The new player theme picker offers 12 color themes — Crimson, Midnight, Ocean, Emerald, Sunset, Gold, Rose, Fuchsia, Lime, Cyan, Royal Purple and Minimal Mono.' },
  { q: 'Will my progress sync between devices?', a: 'Yes. When you\'re signed in, Continue Watching, favorites and watch list sync across phone, tablet and PC instantly.' },
  { q: 'How fresh are new episodes?', a: 'New episodes appear in "Latest Episodes" the same day they release. Enable release reminders to get a push notification 1 hour before each new drop of your favorite show.' },
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
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchTarget, setLaunchTarget] = useState<string>('/');
  // Progress-step checklist shown beneath the bar so the user has tangible
  // feedback (instead of just a moving percentage). Steps tick to true as the
  // simulated launcher passes each threshold.
  const LAUNCH_STEPS = [
    { at: 18, label: 'Connect CDN' },
    { at: 38, label: 'Load library' },
    { at: 58, label: 'Prepare 4K' },
    { at: 78, label: 'Sync history' },
    { at: 100, label: 'Ready' },
  ];
  const [referOpen, setReferOpen] = useState(false);
  const [referCopied, setReferCopied] = useState(false);
  const [referBanUntil, setReferBanUntil] = useState<number>(() => {
    const v = Number(localStorage.getItem('refer_ban_until') || 0);
    return Number.isFinite(v) ? v : 0;
  });
  const [referNow, setReferNow] = useState<number>(Date.now());
  const REFER_LINK = 'https://animesavi.com';
  const referBanLeft = Math.max(0, referBanUntil - referNow);
  const handleCopyReferral = async () => {
    if (referBanLeft > 0) return;
    try {
      await navigator.clipboard.writeText(REFER_LINK);
    } catch {
      const el = document.createElement('textarea');
      el.value = REFER_LINK;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    const used = Number(localStorage.getItem('refer_used_count') || 0) + 1;
    localStorage.setItem('refer_used_count', String(used));
    if (used >= 2) {
      const until = Date.now() + 10 * 60 * 1000;
      localStorage.setItem('refer_ban_until', String(until));
      setReferBanUntil(until);
    }
    setReferCopied(true);
    setTimeout(() => setReferCopied(false), 2200);
  };

  const startWatching = (target: string = '/') => {
    if (isLaunching) return;
    setLaunchTarget(target);
    setLaunchError(null);
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
      try {
        // If the user is offline, bail out early with a clear error so they
        // don't sit staring at a spinner.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setLaunchError('You appear to be offline. Reconnect and try again.');
          return;
        }
        const elapsed = performance.now() - start;
        const pct = Math.min(100, (elapsed / duration) * 100);
        setLaunchProgress(pct);
        const stage = [...stages].reverse().find((s) => pct >= s.at);
        if (stage) setLaunchStage(stage.label);
        if (pct < 100) {
          requestAnimationFrame(tick);
        } else {
          setLaunchStage('Ready');
          setTimeout(() => {
            try {
              navigate(target);
            } catch (err) {
              console.error('[welcome] navigate failed', err);
              setLaunchError('Something blocked the redirect. Please try again.');
            }
          }, 220);
        }
      } catch (err) {
        console.error('[welcome] launch tick failed', err);
        setLaunchError('Playback setup failed. Please retry.');
      }
    };
    requestAnimationFrame(tick);
  };

  const retryLaunch = () => {
    setIsLaunching(false);
    setLaunchError(null);
    // brief tick to let state flush before restarting
    setTimeout(() => startWatching(launchTarget), 50);
  };

  useEffect(() => {
    const FEATURED_TITLES = [
      'That Time I Got Reincarnated as a Slime',
      'Solo Leveling',
      'Demon Slayer',
      'Frieren: Beyond Journey\u2019s End',
      'Dandadan',
    ];
    const fetchFeatured = async () => {
      // Try the curated set first (matches against multiple title spellings).
      const { data: curated } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres, view_count')
        .or(
          FEATURED_TITLES
            .map((t) => `title.ilike.%${t.replace(/[%]/g, '').slice(0, 40)}%`)
            .join(','),
        )
        .limit(8);

      let list = curated || [];
      // Fallback: top up with is_featured if curated set is short, never include Jujutsu Kaisen.
      if (list.length < 5) {
        const { data: fallback } = await supabase
          .from('anime')
          .select('id, title, cover_image, genres, view_count')
          .eq('is_featured', true)
          .neq('title', 'Jujutsu Kaisen')
          .neq('title', 'My Hero Academia')
          .limit(8);
        const existing = new Set(list.map((a) => a.id));
        list = [...list, ...((fallback || []).filter((a) => !existing.has(a.id)))].slice(0, 8);
      }
      if (list.length) setFeaturedAnime(list);
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

  useEffect(() => {
    if (!referOpen || referBanUntil <= Date.now()) return;
    const id = setInterval(() => setReferNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [referOpen, referBanUntil]);

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
    { icon: Zap, title: 'Lightning Fast', desc: 'Stream instantly with H.Savi, Multi.Savi, and X-PLUS. Pick your favorite server anytime with no forced switching.', highlight: true },
    { icon: Shield, title: '100% Ad-Free', desc: 'No ads, no popups, no interruptions. Just pure, uninterrupted anime watching experience from start to finish.', highlight: true },
    { icon: Download, title: 'Smart Downloads', desc: 'Download in 480p, 720p, 1080p or even 2160p (4K) with proper episode names, codec info & quality tags.' },
    { icon: Smartphone, title: 'Mobile First', desc: 'Designed for phones with compact controls, gesture navigation, PiP, and iOS-optimized H.Savi server.' },
    { icon: Globe, title: 'Hindi Dubbed', desc: 'Official Hindi DUB available for all anime — completely free, anytime, anywhere in the world.' },
    { icon: Users, title: 'Watch Parties', desc: 'Invite friends for synced playback, live chat, reactions, persistent rooms and a quick AI recap before you start.' },
    { icon: Headphones, title: 'Multi-Audio', desc: 'Switch between Hindi, English, and Japanese audio tracks on the fly without reloading the video.' },
    
    { icon: Monitor, title: 'MuseIN & Crunchy', desc: 'Dedicated tabs for Muse India and Crunchyroll content with smart auto-tagging and Watch List support.' },
  ];

  const heroAnime = featuredAnime[activeIndex];

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-visible bg-background">
      {/* Cinematic Hero Background — full bleed with parallax-like layering */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {heroAnime?.cover_image ? (
          <div className="absolute inset-0 transition-opacity duration-[1200ms]">
            <img
              src={heroAnime.cover_image}
              alt=""
              className="w-full h-[85vh] object-cover object-top scale-110 transition-transform duration-[8000ms] ease-out"
              loading="eager"
            />
            {/* Triple-layer cinematic gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/75 to-background" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-background/20" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background)/0.85)_85%)]" />
            {/* Film grain overlay */}
            <div
              className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }}
            />
          </div>
        ) : (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)' }} />
        )}
        {/* Decorative floating glow blobs */}
        <div className="absolute top-1/3 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/8 blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
      </div>

      {/* Top bar — glass nav strip */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 backdrop-blur-md bg-background/30 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-primary/40 blur-lg" />
            <img src={logo} alt="AnimeSavi" className="relative h-9 w-9 rounded-xl object-contain" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base sm:text-lg font-bold">
              <span className="text-primary">Anime</span>
              <span className="text-foreground">Savi</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold mt-0.5">Hindi · Free · 4K</span>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-sm border border-border/40 hover:border-primary/40">
          <Home className="w-4 h-4 transition-transform group-hover:-rotate-12" />
          <span className="hidden sm:inline">Home</span>
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-8 pb-16">
        {/* HERO SECTION — Cinematic identity */}
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-7 mt-8 sm:mt-16">
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-md border border-emerald-500/30 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-emerald-300">Streaming Live · 4 Servers Active</span>
          </div>

          {/* Logo + Title block */}
          <div className="flex flex-col items-center gap-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
            <div className="relative">
              {/* Slim ambient bars (replaces the big iOS ping circles) */}
              <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 h-[3px] w-16 rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent animate-pulse" />
              <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" style={{ animationDelay: '0.4s' }} />

              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent)))',
                  boxShadow: '0 0 60px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
                }}
              >
                <img src={logo} alt="AnimeSavi" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-2xl" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[0.95]">
                <span className="bg-gradient-to-r from-primary via-rose-400 to-primary bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 4px 20px hsl(var(--primary) / 0.3))' }}>Anime</span>
                <span className="text-foreground">Savi</span>
              </h1>
              <p className="text-base sm:text-xl text-foreground/80 max-w-xl mx-auto leading-relaxed font-medium">
                One home for every anime you love.
                <span className="block text-sm sm:text-base text-muted-foreground mt-1.5 font-normal">
                  Stream in crisp 4K with official Hindi dubs, instant downloads, and zero ads — built by fans, tuned for binge nights.
                </span>
              </p>
            </div>

            {/* Trust badges row */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              {[
                { icon: Shield, label: 'Zero Ads' },
                { icon: Globe, label: 'Hindi Dub' },
                { icon: Zap, label: '< 1.2s Start' },
                { icon: Lock, label: 'Private' },
              ].map((b) => (
                <span key={b.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/40 backdrop-blur-sm border border-border/30 text-[10px] sm:text-xs font-semibold text-foreground/70">
                  <b.icon className="w-3 h-3 text-primary" />
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Premium Search bar */}
          <form onSubmit={handleSearch} className="w-full max-w-2xl animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div
              className="relative group transition-all duration-300"
              style={{
                boxShadow: isFocused
                  ? '0 12px 50px hsl(var(--primary) / 0.3), 0 0 0 2px hsl(var(--primary) / 0.5)'
                  : '0 8px 40px hsl(0 0% 0% / 0.4)',
                borderRadius: '1.25rem',
              }}
            >
              {/* Animated gradient ring on focus */}
              <div
                className="absolute -inset-px rounded-[1.25rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: 'linear-gradient(120deg, hsl(var(--primary) / 0.6), transparent, hsl(var(--primary) / 0.6))',
                  padding: '1px',
                }}
              />
              <div className="relative flex items-center bg-card/95 backdrop-blur-xl rounded-[1.2rem] border border-border/40">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200" style={{ color: isFocused ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Search anime, movies, characters…"
                  className="w-full pl-14 pr-4 py-4 sm:py-5 rounded-[1.2rem] text-base sm:text-lg bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
                {searchQuery ? (
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold text-primary-foreground bg-primary transition-all duration-200 hover:scale-105 shadow-lg shadow-primary/30">
                    Search
                  </button>
                ) : (
                  <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-muted-foreground bg-card border border-border/50">
                    <span>⌘</span>K
                  </kbd>
                )}
              </div>
            </div>

            {/* Trending search hints */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mr-1">Trending:</span>
              {['Solo Leveling', 'Demon Slayer', 'That Time I Got Reincarnated as a Slime', 'Witch hat atelier'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => navigate(`/browse?q=${encodeURIComponent(t)}`)}
                  className="text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 rounded-md hover:bg-card/50"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>

          {/* Quick links — pill-style nav */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 animate-fade-in" style={{ animationDelay: '250ms' }}>
            {quickLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.path)}
                className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-md text-foreground/80 border border-border/40 hover:border-primary/50 hover:bg-card hover:text-foreground"
              >
                <link.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary transition-transform group-hover:scale-110" />
                {link.label}
              </button>
            ))}
          </div>

          {/* Featured anime carousel — refined cinematic shelf */}
          {featuredAnime.length > 0 && (
            <div className="w-full max-w-3xl mt-4 animate-fade-in" style={{ animationDelay: '350ms' }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 rounded-full bg-primary" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-foreground">Featured Right Now</span>
                </div>
                <button onClick={() => navigate('/browse?sort=popular')} className="text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                {featuredAnime.slice(0, 7).map((anime, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={anime.id}
                      onClick={() => navigate(`/anime/${anime.id}`)}
                      className="relative flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 cursor-pointer group/card"
                      style={{
                        width: isActive ? '130px' : '60px',
                        height: isActive ? '185px' : '88px',
                        opacity: isActive ? 1 : 0.45,
                        transform: isActive ? 'scale(1) translateY(-4px)' : 'scale(0.95)',
                        boxShadow: isActive ? '0 12px 40px hsl(var(--primary) / 0.35), 0 0 0 2px hsl(var(--primary) / 0.6)' : '0 2px 10px hsl(0 0% 0% / 0.3)',
                      }}
                    >
                      {anime.cover_image ? (
                        <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-accent" />
                      )}
                      {isActive && (
                        <>
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/90 backdrop-blur-sm">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-primary-foreground">#{i + 1}</span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-2" style={{ background: 'linear-gradient(to top, hsl(0 0% 0% / 0.95), transparent)' }}>
                            <p className="text-[10px] sm:text-xs text-foreground font-bold truncate text-center">{anime.title}</p>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Slim progress-bar style pagination */}
              <div className="flex items-center justify-center gap-1 mt-4">
                {featuredAnime.slice(0, 7).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className="transition-all duration-500 rounded-full overflow-hidden"
                    style={{
                      width: i === activeIndex ? '28px' : '8px',
                      height: '3px',
                      background: i === activeIndex ? 'transparent' : 'hsl(var(--muted-foreground) / 0.25)',
                    }}
                  >
                    {i === activeIndex && (
                      <div className="h-full w-full bg-primary" style={{ animation: 'shrink 4s linear' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA Buttons — premium */}
          <div className="flex items-center gap-3 animate-fade-in mt-2" style={{ animationDelay: '450ms' }}>
            <button
              onClick={() => startWatching('/')}
              className="group relative flex items-center gap-2.5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-bold transition-all duration-300 hover:scale-105 bg-primary text-primary-foreground overflow-hidden"
              style={{ boxShadow: '0 8px 32px hsl(var(--primary) / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.2)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Play className="relative w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span className="relative">Start Watching</span>
            </button>
            <button onClick={() => navigate('/browse')} className="group flex items-center gap-2 px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base font-semibold transition-all duration-200 hover:scale-105 bg-card/60 backdrop-blur-md text-foreground border border-border/40 hover:border-primary/40">
              Browse All
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Live Stats Bar — cinematic upgrade */}
        <div className="w-full max-w-4xl mx-auto mt-16 animate-fade-in" style={{ animationDelay: '550ms' }}>
          <div className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-xl border border-border/40">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
            <div className="relative grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/20">
              {[
                { value: totalAnime || 100, suffix: '+', label: 'Anime Titles', icon: Film, accent: 'text-primary' },
                { value: totalEpisodes || 500, suffix: '+', label: 'Episodes', icon: Play, accent: 'text-sky-400' },
                { value: '24/7', suffix: '', label: 'Free Streaming', icon: Zap, accent: 'text-emerald-400' },
                { value: '0', suffix: '', label: 'Ads. Ever.', icon: Shield, accent: 'text-rose-400' },
              ].map((stat) => (
                <div key={stat.label} className="group flex flex-col items-center justify-center text-center py-5 px-3 transition-all hover:bg-card/40">
                  <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.accent} mb-2 transition-transform group-hover:scale-110`} />
                  <p className={`text-2xl sm:text-4xl font-extrabold ${stat.accent} tabular-nums leading-none`}>
                    {stat.value}{stat.suffix}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 font-semibold uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
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
              { icon: Users, title: 'Watch Parties', desc: 'Host or join real-time watch rooms with friends. Synced playback, live chat, emoji reactions, persistent rooms and AI episode recaps before each session.', gradient: 'from-primary/10 to-primary/5' },
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
              { icon: HardDrive, label: 'Storage Used', value: '48TB+', color: 'text-blue-400' },
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

        {/* Watch Instantly — how fast streaming works */}
        <div className="w-full max-w-4xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '958ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Watch Instantly</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Press Play. Skip the Wait.</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">Our streaming stack is tuned so the first frame appears in under a second on most networks.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: Zap, title: 'Sub-second start', desc: 'Tiny initial buffer + first-fragment prefetch deliver an instant first frame, then the buffer grows in the background.' },
              { icon: Layers, title: 'Adaptive 144p → 4K', desc: 'HLS dynamically picks the best quality your connection can sustain — upgrades to 4K within seconds when bandwidth allows.' },
              { icon: Wifi, title: 'Network-aware', desc: 'Detects 2G / 3G / cellular vs Wi-Fi and tunes buffer size, retries and start level so playback never stalls.' },
            ].map((b, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"><b.icon className="w-5 h-5 text-primary" /></div>
                <h3 className="text-sm font-bold text-foreground">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
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
              { icon: Crown, title: 'Persistent Watch Rooms', desc: 'Resume group sessions days later — chat history, queue and playback position all saved.', tag: 'Live', href: '/' },
              { icon: Flame, title: 'Smart Recommendations 2.0', desc: 'Genre + mood-aware suggestions tuned by your real watch history and ratings.', tag: 'Live', href: '/' },
              { icon: Calendar, title: 'Seasonal Anime Tracker', desc: 'A single dashboard for every airing show this season with episode countdowns.', tag: 'Beta', href: '/schedule' },
              { icon: BarChart3, title: 'Personal Watch Stats', desc: 'Total hours watched, top genres, longest streaks and a year-in-review wrap.', tag: 'Live', href: '/stats' },
              { icon: MapPin, title: 'AI Episode Recaps', desc: 'Auto-generated 30-second recaps so you never lose track of long-running shows.', tag: 'Beta' },
            ].map((r, i) => {
              const isLive = r.tag === 'Live';
              const isBeta = r.tag === 'Beta';
              const isClickable = (isLive || isBeta) && !!r.href;
              const Wrapper: any = isClickable ? 'a' : 'div';
              const wrapperProps = isClickable ? { href: r.href } : {};
              const badgeClass = isLive
                ? 'bg-emerald-500/20 text-emerald-400'
                : isBeta
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-primary/15 text-primary';
              return (
                <Wrapper key={i} {...wrapperProps} className={`relative p-5 rounded-2xl bg-card/40 border border-border/30 transition-all duration-300 block ${isClickable ? 'hover:border-primary/60 hover:bg-card/60 cursor-pointer' : 'hover:border-primary/30'}`}>
                  <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>{r.tag}</span>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3"><r.icon className="w-5 h-5 text-primary" /></div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{r.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                </Wrapper>
              );
            })}
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

        {/* Compare AnimeSavi vs Others */}
        <div className="w-full max-w-4xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '978ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Why Switch</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">AnimeSavi vs Other Sites</h2>
            <p className="text-muted-foreground text-sm mt-2">No premium walls. No ads. Just anime.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/30 bg-card/40">
            <div className="grid grid-cols-3 text-xs sm:text-sm">
              <div className="px-3 sm:px-5 py-3 font-semibold text-foreground/70 border-b border-border/30">Feature</div>
              <div className="px-3 sm:px-5 py-3 font-bold text-primary border-b border-l border-border/30 text-center">AnimeSavi</div>
              <div className="px-3 sm:px-5 py-3 font-semibold text-muted-foreground border-b border-l border-border/30 text-center">Others</div>
              {[
                ['4K streaming', '✓ Free', 'Premium only'],
                ['Hindi dubs', '✓ Native multi-audio', 'Limited / dubbed sites'],
                ['Ads & popups', 'Zero', 'Heavy'],
                ['Offline downloads', '✓ All qualities', '✗ or paid'],
                ['Watch parties', '✓ Built-in', 'Extension required'],
                ['Account required', 'Only for token', 'Required + paid'],
                ['Payments', 'Never', '₹499–999/mo'],
              ].map((row, i) => (
                <div key={i} className="contents">
                  <div className={`px-3 sm:px-5 py-3 text-foreground/80 ${i % 2 ? 'bg-card/30' : ''}`}>{row[0]}</div>
                  <div className={`px-3 sm:px-5 py-3 border-l border-border/30 text-center font-semibold text-emerald-400 ${i % 2 ? 'bg-card/30' : ''}`}>{row[1]}</div>
                  <div className={`px-3 sm:px-5 py-3 border-l border-border/30 text-center text-muted-foreground ${i % 2 ? 'bg-card/30' : ''}`}>{row[2]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Community */}
        <div className="w-full max-w-5xl mx-auto mt-24 animate-fade-in" style={{ animationDelay: '982ms' }}>
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/10 text-primary mb-3">Community</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Join 50,000+ Anime Fans</h2>
            <p className="text-muted-foreground text-sm mt-2">Get notified about new drops, share recommendations, talk theories.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {[
              { icon: Send, title: 'Telegram Channel', desc: 'Daily upload alerts + early Hindi dub announcements.', cta: 'Join Channel', href: 'https://t.me/Lv_Savi', kind: 'link' as const },
              { icon: Share2, title: 'Refer a Friend', desc: 'Invite a friend and you both unlock 2 days of free premium access.', cta: 'Get Referral Link', kind: 'refer' as const },
            ].map((c, i) =>
              c.kind === 'refer' ? (
                <button key={i} type="button" onClick={() => setReferOpen(true)} className="group flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/40 hover:bg-card/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform"><c.icon className="w-6 h-6 text-primary" /></div>
                  <h3 className="text-base font-bold text-foreground">{c.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary">
                    {c.cta}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
              ) : (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/40 hover:bg-card/60 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform"><c.icon className="w-6 h-6 text-primary" /></div>
                  <h3 className="text-base font-bold text-foreground">{c.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary">
                    {c.cta}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </a>
              )
            )}
          </div>

          {/* More info: Quick Facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { icon: Zap, title: '< 2s', sub: 'Avg load time' },
              { icon: Globe, title: '180+', sub: 'Countries served' },
              { icon: Layers, title: '4K HDR', sub: 'Top quality tier' },
              { icon: Wifi, title: 'Offline', sub: 'Watch anywhere' },
              { icon: Headphones, title: 'Multi-Audio', sub: 'Hindi / EN / JP' },
              { icon: Bell, title: 'Live Alerts', sub: 'Pre-release pings' },
              { icon: Cast, title: 'Cast & PiP', sub: 'TV + mini player' },
              { icon: Lock, title: 'Privacy First', sub: 'No trackers' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-card/30 border border-border/20">
                <f.icon className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{f.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{f.sub}</div>
                </div>
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

      {/* Refer a Friend dialog */}
      {referOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setReferOpen(false);
          }}
        >
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl pointer-events-auto"
            style={{ background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--card) / 0.9))' }}
          >
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); setReferOpen(false); }}
              onClick={(e) => { e.stopPropagation(); setReferOpen(false); }}
              aria-label="Close"
              className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition touch-manipulation"
            >
              ✕
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Refer a Friend</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Share our website link to your friend to get 2 Day free subscription.
              </p>

              <div className="w-full mt-4 flex items-stretch gap-2 rounded-xl border border-border/50 bg-muted/30 p-1.5">
                <input
                  readOnly
                  value={REFER_LINK}
                  className="flex-1 bg-transparent px-3 text-sm text-foreground/90 outline-none truncate"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleCopyReferral(); }}
                  disabled={referBanLeft > 0}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition touch-manipulation shrink-0"
                >
                  {referCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                When your friend opens our website and logs in or signs up, you and your friend will automatically get 2 Day free subscription access. You must be logged in first.
              </p>

              <div className="mt-4 w-full flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <Shield className="w-3 h-3 text-primary" />
                <span>One referral per user. Repeated copies trigger a 10-minute cooldown.</span>
              </div>

              {referBanLeft > 0 && (
                <div className="mt-3 w-full px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive font-semibold">
                  Cooldown active — try again in {Math.floor(referBanLeft / 60000)}m {Math.floor((referBanLeft % 60000) / 1000)}s.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cinematic launch loader — shown when user clicks "Start Watching" */}
      {isLaunching && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Loading AnimeSavi"
          style={{
            background:
              'radial-gradient(ellipse at top, hsl(var(--primary) / 0.18), transparent 55%), radial-gradient(ellipse at bottom, hsl(330 80% 50% / 0.12), transparent 55%), hsl(var(--background))',
          }}
        >
          {/* Animated grid backdrop */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />

          {/* Floating orbs */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl bg-primary/25 animate-pulse pointer-events-none" />
          <div
            className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl bg-fuchsia-500/20 animate-pulse pointer-events-none"
            style={{ animationDelay: '0.8s' }}
          />

          {/* Top scan line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

          <div className="relative w-full max-w-md mx-auto px-6 flex flex-col items-center gap-8 text-center">
            {/* Orbital logo */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Outer rotating ring */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 120 120"
                style={{ animation: 'spin 6s linear infinite' }}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="56"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  strokeDasharray="6 10"
                  opacity="0.55"
                />
              </svg>
              {/* Inner counter-rotating ring */}
              <svg
                className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]"
                viewBox="0 0 120 120"
                style={{ animation: 'spin 4s linear infinite reverse' }}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="80 220"
                  strokeLinecap="round"
                />
              </svg>
              {/* Pulse halos */}
              <span className="pointer-events-none absolute inset-x-6 -top-3 h-[3px] rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
              {/* Logo core */}
              <div
                className="relative w-20 h-20 rounded-3xl flex items-center justify-center overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary) / 0.35), hsl(330 80% 55% / 0.4))',
                  boxShadow:
                    '0 0 80px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25)',
                }}
              >
                <img src={logo} alt="AnimeSavi" className="w-12 h-12 object-contain drop-shadow-lg" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight">
                <span
                  className="bg-gradient-to-r from-primary via-rose-400 to-fuchsia-500 bg-clip-text text-transparent"
                  style={{ backgroundSize: '200% 100%', animation: 'shimmer-text 3s linear infinite' }}
                >
                  AnimeSavi
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground font-semibold tracking-[0.25em] uppercase flex items-center justify-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                {launchStage}
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.3s' }} />
              </p>
            </div>

            {/* Progress bar — premium */}
            <div className="w-full space-y-2.5">
              <div
                className="relative h-2 w-full rounded-full overflow-hidden border border-border/40"
                style={{ background: 'hsl(var(--card) / 0.6)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
                  style={{
                    width: `${launchProgress}%`,
                    background:
                      'linear-gradient(90deg, hsl(var(--primary)), hsl(330 85% 60%), hsl(var(--primary)))',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer-text 2s linear infinite',
                    boxShadow: '0 0 16px hsl(var(--primary) / 0.7)',
                  }}
                />
                {/* Sweep highlight */}
                <div
                  className="absolute inset-y-0 w-1/3 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent)',
                    animation: 'sweep 1.6s ease-in-out infinite',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold tabular-nums">
                <span className="text-foreground/90">{Math.floor(launchProgress)}%</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(142_72%_45%)]" />
                  H.Savi · 4K Ready
                </span>
              </div>
            </div>

            {/* Progress step checklist — clearly shows each phase ticking off */}
            <ul className="w-full grid grid-cols-5 gap-1.5">
              {LAUNCH_STEPS.map((step) => {
                const done = launchProgress >= step.at;
                const active = !done && launchProgress >= (step.at - 20);
                return (
                  <li
                    key={step.label}
                    className={`flex flex-col items-center gap-1 rounded-md py-1.5 px-0.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-wider border transition-all duration-300 ${
                      done
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : active
                        ? 'border-primary/40 bg-primary/10 text-primary animate-pulse'
                        : 'border-border/30 bg-card/30 text-muted-foreground/60'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : active ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <span className="leading-none text-center line-clamp-1">{step.label}</span>
                  </li>
                );
              })}
            </ul>

            {/* Feature pills */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {['Ad-free', 'Hindi DUB', 'Offline', 'No Login'].map((label, i) => (
                <span
                  key={label}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-border/40 bg-card/50 backdrop-blur animate-fade-in"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Error state — shown if the launcher fails or the user is offline */}
            {launchError && (
              <div className="w-full rounded-xl border border-destructive/40 bg-destructive/10 backdrop-blur p-4 animate-fade-in space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive text-xs font-bold">!</span>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-snug text-left">{launchError}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={retryLaunch}
                    className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                    className="flex-1 h-9 rounded-md border border-border bg-background/40 text-foreground text-xs font-semibold hover:bg-background/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Tip */}
            <p className="text-[11px] text-muted-foreground/70 max-w-xs leading-relaxed">
              Pin AnimeSavi to your home screen for an instant native-app experience.
            </p>
          </div>

          <style>{`
            @keyframes shimmer-text { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
            @keyframes sweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
          `}</style>
        </div>
      )}

      {/* === New: By the numbers === */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-12">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">By the Numbers</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">AnimeSavi at a glance</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { v: totalAnime ? `${totalAnime}+` : '500+', l: 'Anime titles', icon: Film },
            { v: totalEpisodes ? `${totalEpisodes.toLocaleString()}+` : '15K+', l: 'Episodes', icon: Layers },
            { v: '12', l: 'Player themes', icon: Palette },
            { v: '4K', l: 'Max quality', icon: Monitor },
            { v: '4', l: 'Streaming servers', icon: Radio },
            { v: '5', l: 'Profiles / account', icon: Users },
            { v: '0', l: 'Ads, ever', icon: Shield },
            { v: '24/7', l: 'Support on TG', icon: Send },
          ].map(({ v, l, icon: Icon }) => (
            <div
              key={l}
              className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 hover:border-primary/40 hover:bg-card/70 transition-all"
            >
              <Icon className="absolute -bottom-2 -right-2 w-12 h-12 text-primary/10 group-hover:text-primary/25 transition-colors" />
              <p className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-br from-primary to-fuchsia-400 bg-clip-text text-transparent">{v}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* === New: How it works === */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pb-12">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">Four steps. Zero friction.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { n: '01', t: 'Open', d: 'Tap Start Watching — no signup required to browse the catalog.', icon: Play },
            { n: '02', t: 'Pick', d: 'Filter by genre, year, dub language or jump into Trending Now.', icon: Compass },
            { n: '03', t: 'Play', d: 'Hit play and the best server is preselected for your network.', icon: Zap },
            { n: '04', t: 'Sync', d: 'Sign in to sync watch history, list and favorites across devices.', icon: RefreshCw },
          ].map((s) => (
            <div key={s.n} className="relative rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 hover:border-primary/40 transition-colors">
              <span className="absolute top-3 right-3 text-[10px] font-bold text-primary/60 tracking-widest">{s.n}</span>
              <s.icon className="w-6 h-6 text-primary mb-2" />
              <p className="text-sm font-bold mb-1">{s.t}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* === New: What's inside (deeper feature deck) === */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pb-12">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">What's inside</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">More than just a player</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { i: Bell, t: 'Push alerts', d: '1-hour pre-release pings' },
            { i: Lock, t: 'PIN lock', d: '4 or 6-digit profile guard' },
            { i: Cast, t: 'Cast & AirPlay', d: 'Simple Mode for TVs' },
            { i: HardDrive, t: 'Offline downloads', d: '480p → 4K stored locally' },
            
            { i: Keyboard, t: 'Keyboard shortcuts', d: 'Press / to search anywhere' },
            { i: Calendar, t: 'Release calendar', d: 'See exact drop times' },
            { i: BarChart3, t: 'Personal stats', d: 'Genre & watch insights' },
            { i: MessageCircle, t: 'Watch parties', d: 'Sync + live chat' },
            { i: Wifi, t: 'Auto-quality', d: 'Adapts to your network' },
            { i: Eye, t: 'Continue watching', d: 'Per-profile resume row' },
            { i: Crown, t: 'Premium feel, free', d: 'No paywalls anywhere' },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-lg border border-border/30 bg-card/30 backdrop-blur p-3 hover:border-primary/40 hover:bg-card/60 transition-all">
              <Icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-xs font-bold leading-tight">{t}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* === New: Device support matrix === */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-8 pb-16">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">Works everywhere</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold">Built for every screen</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { i: Smartphone, t: 'iOS', d: 'Safari + PWA push' },
            { i: Smartphone, t: 'Android', d: 'Chrome + install' },
            { i: Monitor, t: 'Desktop', d: 'PiP + shortcuts' },
            { i: Tv, t: 'TV / Cast', d: 'AirPlay + cast' },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="text-center rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4 hover:border-primary/40 transition-colors">
              <Icon className="w-7 h-7 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold">{t}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </section>

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
