import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Home, Play, ChevronRight, Radio, Tv, Film, Sparkles, Flame,
  Globe, Headphones, Download, Shield, Zap, Calendar, Bell, Wifi,
  Monitor, Smartphone, Cast, Users, Crown, Lock, Eye, Compass, HardDrive,
  Volume2, Star, ArrowRight, Signal, Clock, PlayCircle, Layers, MessageCircle,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { supabase } from '@/integrations/supabase/client';

interface AnimePreview {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
  view_count: number | null;
}

/* ---------- Static editorial content ---------- */

const CHANNELS = [
  { code: 'CH·01', label: 'Hindi Dub Premiere',  hint: 'Fresh drops · daily' },
  { code: 'CH·02', label: 'Subbed Simulcast',    hint: '< 1h after Japan' },
  { code: 'CH·03', label: 'Movie Theatre',       hint: '4K HDR feature reel' },
  { code: 'CH·04', label: 'Late Night Binge',    hint: 'Shounen marathons' },
];

const TICKER = [
  '4 active CDN servers',
  'Hindi · English · Japanese audio',
  '4K UHD playback site-wide',
  'No ads. No popups. No paywalls.',
  '1-hour pre-release push alerts',
  '5 profiles per family account',
  'Offline downloads up to 4K',
  'Watch parties with live chat',
];

const MOOD_TILES = [
  { tag: 'Slice of Life',  hue: 'from-amber-500/60 to-rose-400/40',     line: 'sundown rooftops, soft jazz' },
  { tag: 'Mecha & Sci-Fi', hue: 'from-cyan-500/60 to-indigo-500/40',    line: 'neon plating, cockpit haze' },
  { tag: 'Dark Fantasy',   hue: 'from-violet-700/70 to-slate-900/40',   line: 'cathedral dust, blood moons' },
  { tag: 'Sports',         hue: 'from-emerald-500/60 to-sky-400/40',    line: 'court squeak, last seconds' },
  { tag: 'Romance',        hue: 'from-pink-500/60 to-rose-400/40',      line: 'soft hands, train rides' },
  { tag: 'Isekai',         hue: 'from-orange-500/60 to-yellow-400/40',  line: 'guild halls, level-ups' },
];

const PILLARS = [
  { icon: Shield,    title: 'Zero Ads, Zero Walls',   body: 'No banners, no preroll, no premium tier hiding episodes. Every feature, free, forever.' },
  { icon: Globe,     title: 'Official Hindi Dub',     body: 'Hindi alongside English & Japanese — switch tracks mid-episode without reloading the player.' },
  { icon: Zap,       title: 'Sub-second Start',       body: 'H.Savi, Multi.Savi and X-PLUS pre-warm. Tap play and the first frame is on screen in under a second.' },
  { icon: Download,  title: 'Real 4K Downloads',      body: 'Save in 480p → 2160p with proper episode names, codec tag & audio language baked into the filename.' },
  { icon: Users,     title: 'Watch Parties + Chat',   body: 'Sync playback with friends, react in a live chat sidebar, and pick up where the party left off.' },
  { icon: Bell,      title: 'Heads-up Notifications', body: 'Get a push exactly 1 hour before your favorite show airs — perfectly timed, never spammy.' },
];

const TIMELINE = [
  { t: '00:00', label: 'Tap Start Watching', body: 'No signup. Browse the full catalog instantly.' },
  { t: '00:08', label: 'Pick a channel',     body: 'Trending now, simulcast, Hindi premieres or a curated genre row.' },
  { t: '00:14', label: 'Hit play',           body: 'Best server auto-picked for your network — change anytime.' },
  { t: '00:20', label: 'Sync your shelf',    body: 'Sign in once and watch history, list & favorites follow every device.' },
];

const SPECS = [
  { k: 'Codec',          v: 'H.264 · H.265 · AV1' },
  { k: 'Max bitrate',    v: '24 Mbps (4K HDR)' },
  { k: 'Audio',          v: 'AAC · E-AC3 5.1' },
  { k: 'Subtitles',      v: 'VTT · ASS · SRT' },
  { k: 'Servers',        v: 'H.Savi · Multi · X-PLUS · Embed' },
  { k: 'Profiles',       v: 'Up to 5 (admin: 9)' },
  { k: 'Player themes',  v: '12 named palettes' },
  { k: 'PWA install',    v: 'iOS Safari · Android Chrome' },
];

const VOICES = [
  { who: 'Arjun · Mumbai',   line: 'Best Hindi dub library on the open web. Period.' },
  { who: 'Priya · Bengaluru', line: 'Downloads keep my commute alive. 4K, named files, no fuss.' },
  { who: 'Rahul · Delhi',    line: 'Watch parties with the squad on Sunday — sync is instant.' },
  { who: 'Sneha · Pune',     line: 'Feels like a paid app. It is not. That is the wild part.' },
];

const LOADER_BEATS = [
  { at: 0,   label: 'Tuning signal' },
  { at: 22,  label: 'Reel · 01 loaded' },
  { at: 44,  label: 'Reel · 02 loaded' },
  { at: 66,  label: 'Color graded' },
  { at: 86,  label: 'Audio synced' },
  { at: 100, label: 'On air' },
];

export default function Welcome() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [featuredAnime, setFeaturedAnime] = useState<AnimePreview[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [totalAnime, setTotalAnime] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [clock, setClock] = useState(() => new Date());

  // Loader state
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchBeat, setLaunchBeat] = useState(LOADER_BEATS[0].label);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchTarget, setLaunchTarget] = useState<string>('/');
  const [countdown, setCountdown] = useState<number | null>(null);

  /* ---------- Data ---------- */
  useEffect(() => {
    (async () => {
      const FEATURED_TITLES = [
        'Solo Leveling', 'Demon Slayer', 'Frieren', 'Dandadan',
        'That Time I Got Reincarnated as a Slime',
      ];
      const { data: curated } = await supabase
        .from('anime')
        .select('id, title, cover_image, genres, view_count')
        .or(FEATURED_TITLES.map(t => `title.ilike.%${t.slice(0, 40)}%`).join(','))
        .limit(8);
      let list = curated || [];
      if (list.length < 5) {
        const { data: fb } = await supabase
          .from('anime').select('id, title, cover_image, genres, view_count')
          .eq('is_featured', true).neq('title', 'Jujutsu Kaisen').limit(8);
        const seen = new Set(list.map(a => a.id));
        list = [...list, ...((fb || []).filter(a => !seen.has(a.id)))].slice(0, 8);
      }
      if (list.length) setFeaturedAnime(list);

      const [{ count: ac }, { count: ec }] = await Promise.all([
        supabase.from('anime').select('id', { count: 'exact', head: true }),
        supabase.from('episodes').select('id', { count: 'exact', head: true }),
      ]);
      if (ac) setTotalAnime(ac);
      if (ec) setTotalEpisodes(ec);
    })();
  }, []);

  useEffect(() => {
    if (featuredAnime.length <= 1) return;
    const id = setInterval(() => setActiveIndex(p => (p + 1) % featuredAnime.length), 4200);
    return () => clearInterval(id);
  }, [featuredAnime.length]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- Launch sequence: liquid-glass loader → navigate ---------- */
  const startWatching = (target: string = '/') => {
    if (isLaunching) return;
    setLaunchTarget(target);
    setLaunchError(null);
    setLaunchProgress(0);
    setLaunchBeat(LOADER_BEATS[0].label);
    setCountdown(null);
    setIsLaunching(true);
  };

  // Run the progress directly — no countdown
  useEffect(() => {
    if (!isLaunching) return;
    const start = performance.now();
    const duration = 2200;
    let raf = 0;
    const tick = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setLaunchError('You appear to be offline. Reconnect and try again.');
        return;
      }
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setLaunchProgress(pct);
      const beat = [...LOADER_BEATS].reverse().find(b => pct >= b.at);
      if (beat) setLaunchBeat(beat.label);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          try { navigate(launchTarget); }
          catch { setLaunchError('Something blocked the redirect. Please try again.'); }
        }, 260);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isLaunching, launchTarget, navigate]);

  const retryLaunch = () => {
    setIsLaunching(false);
    setLaunchError(null);
    setTimeout(() => startWatching(launchTarget), 60);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const hero = featuredAnime[activeIndex];
  const timeStr = clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      className="relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* ===================== HERO ===================== */}
      <section className="relative isolate">
        {/* backdrop cover */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {hero?.cover_image ? (
            <img
              key={hero.id}
              src={hero.cover_image}
              alt=""
              className="w-full h-[92vh] object-cover object-top opacity-60 animate-fade-in"
              style={{ filter: 'saturate(1.05) contrast(1.05)' }}
            />
          ) : <div className="w-full h-[92vh] bg-accent/40" />}
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          {/* scanlines */}
          <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
               style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)' }} />
        </div>

        {/* Broadcast top bar */}
        <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-10 pt-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute -inset-1 rounded-2xl bg-primary/40 blur-md" />
              <img src={logo} alt="AnimeSavi" className="relative h-9 w-9 rounded-xl object-contain" />
            </div>
            <div className="leading-none">
              <p className="text-base sm:text-lg font-black tracking-tight">
                <span className="text-primary">ANIME</span><span className="text-foreground">SAVI</span>
                <span className="ml-2 text-[10px] font-bold tracking-[0.3em] text-muted-foreground/80">/ BROADCAST</span>
              </p>
              <p className="text-[10px] mt-1 uppercase tracking-[0.3em] text-muted-foreground/70 font-semibold">
                Channel 04 · Live from India · 2026
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-bold text-foreground/70 px-3 py-1.5 rounded-full bg-card/60 backdrop-blur border border-border/40">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-rose-500" />
              </span>
              On Air · {timeStr} IST
            </span>
            <button onClick={() => navigate('/')} className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card/70 backdrop-blur border border-border/40 hover:border-primary/50 transition-all">
              <Home className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>
        </header>

        {/* Editorial gutter — vertical brand stripe + content */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-[72px_1fr] gap-4 sm:gap-8 px-4 sm:px-10 pt-6 sm:pt-16 pb-16 sm:pb-20">
          {/* left vertical gutter */}
          <aside className="hidden sm:flex flex-col items-center gap-4 pt-2">
            <div className="w-px h-12 bg-gradient-to-b from-transparent to-primary/70" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase text-muted-foreground">
              Issue · 26 / Vol · IV
            </span>
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary))]" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase text-primary">
              アニメ サヴィ
            </span>
            <div className="w-px flex-1 bg-gradient-to-b from-primary/40 via-border/30 to-transparent" />
          </aside>

          {/* main hero column */}
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 backdrop-blur border border-primary/30 mb-6 animate-fade-in">
              <Signal className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase text-foreground/80">
                The free-forever anime broadcast
              </span>
            </div>

            <h1 className="font-black leading-[0.9] tracking-tight text-[clamp(2.1rem,8vw,6.5rem)] animate-fade-in break-words">
              <span className="block text-foreground">Anime, the way</span>
              <span className="block">
                <span className="bg-gradient-to-r from-primary via-rose-400 to-fuchsia-500 bg-clip-text text-transparent"
                      style={{ filter: 'drop-shadow(0 6px 30px hsl(var(--primary)/0.35))' }}>
                  it should air.
                </span>
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base sm:text-lg text-foreground/75 leading-relaxed animate-fade-in" style={{ animationDelay: '80ms' }}>
              A free, ad-free streaming channel built for India. Official Hindi dubs,
              4K UHD playback, real downloads, multi-server pick-your-own playback —
              and a viewer-first interface that treats every episode like a premiere.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mt-8 max-w-2xl animate-fade-in" style={{ animationDelay: '160ms' }}>
              <div className="relative group">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/40 via-fuchsia-500/30 to-primary/40 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                <div className="relative flex items-center bg-card/90 backdrop-blur-xl rounded-2xl border border-border/50 shadow-[0_12px_40px_hsl(0_0%_0%/0.45)]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search a title, a director, a vibe…"
                    className="w-full pl-14 pr-32 py-4 sm:py-5 bg-transparent text-base sm:text-lg placeholder:text-muted-foreground/70 focus:outline-none"
                  />
                  <button type="submit"
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:scale-[1.03] transition-transform shadow-lg shadow-primary/30">
                    Search
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 font-bold mr-1">Tonight:</span>
                {['Solo Leveling', 'Demon Slayer', 'Dandadan', 'Frieren'].map(t => (
                  <button key={t} type="button" onClick={() => navigate(`/browse?q=${encodeURIComponent(t)}`)}
                          className="text-[11px] font-semibold text-muted-foreground hover:text-primary px-2.5 py-1 rounded-md bg-card/40 hover:bg-card/80 border border-border/30 transition-colors">
                    {t}
                  </button>
                ))}
              </div>
            </form>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in" style={{ animationDelay: '240ms' }}>
              <button onClick={() => startWatching('/')}
                      className="group relative inline-flex items-center gap-2.5 px-7 sm:px-9 py-4 rounded-2xl text-sm sm:text-base font-black uppercase tracking-wider overflow-hidden bg-primary text-primary-foreground hover:scale-[1.03] transition-transform"
                      style={{ boxShadow: '0 14px 40px hsl(var(--primary)/0.45), inset 0 1px 0 hsl(0 0% 100%/0.25)' }}>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <PlayCircle className="relative w-5 h-5 fill-current" />
                <span className="relative">Start Watching</span>
              </button>
              <button onClick={() => navigate('/browse')}
                      className="group inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-sm sm:text-base font-bold bg-card/60 backdrop-blur border border-border/40 hover:border-primary/50 transition-colors">
                Browse Catalog
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70 font-bold">
                No signup · No card · No ads
              </span>
            </div>

            {/* Featured strip */}
            {featuredAnime.length > 0 && (
              <div className="mt-12 animate-fade-in" style={{ animationDelay: '320ms' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-1 rounded-full bg-primary" />
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] font-bold">Now Programming</span>
                  </div>
                  <button onClick={() => navigate('/browse?sort=popular')}
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 font-semibold">
                    Full schedule <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-end gap-2 sm:gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                  {featuredAnime.slice(0, 7).map((a, i) => {
                    const active = i === activeIndex;
                    return (
                      <button key={a.id} onClick={() => navigate(`/anime/${a.id}`)}
                              className="relative shrink-0 rounded-xl overflow-hidden snap-start transition-all duration-500 group/card"
                              style={{
                                width: active ? 140 : 70,
                                height: active ? 200 : 100,
                                opacity: active ? 1 : 0.5,
                                transform: active ? 'translateY(-6px)' : 'none',
                                boxShadow: active
                                  ? '0 14px 40px hsl(var(--primary)/0.4), 0 0 0 2px hsl(var(--primary)/0.6)'
                                  : '0 4px 14px hsl(0 0% 0%/0.35)',
                              }}>
                        {a.cover_image
                          ? <img src={a.cover_image} alt={a.title} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700" loading="lazy" />
                          : <div className="w-full h-full bg-accent" />}
                        {active && (
                          <>
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-primary/95 text-[8px] font-black uppercase tracking-wider text-primary-foreground">
                              #{i + 1}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/95 to-transparent">
                              <p className="text-[11px] font-bold text-white truncate text-center">{a.title}</p>
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {featuredAnime.slice(0, 7).map((_, i) => (
                    <button key={i} onClick={() => setActiveIndex(i)}
                            className="rounded-full overflow-hidden transition-all duration-500"
                            style={{
                              width: i === activeIndex ? 32 : 8,
                              height: 3,
                              background: i === activeIndex ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground)/0.25)',
                            }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Marquee ticker */}
        <div className="relative z-10 border-y border-border/40 bg-card/40 backdrop-blur-md overflow-hidden">
          <div className="flex gap-10 py-3 whitespace-nowrap" style={{ animation: 'as-marquee 38s linear infinite' }}>
            {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="text-[11px] sm:text-xs uppercase tracking-[0.25em] font-bold text-foreground/70 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CHANNELS ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 py-20">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-black mb-2">/ Channel guide</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Four channels. One remote.</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Each channel is a different mood. Tap one, land directly on a curated row
            tuned for that watch state.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {CHANNELS.map((ch, i) => (
            <button
              key={ch.code}
              onClick={() => navigate('/browse')}
              className="group relative text-left overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur hover:border-primary/50 transition-colors p-5 h-44 flex flex-col justify-between"
            >
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors" />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase">{ch.code}</span>
                <Tv className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="relative">
                <p className="text-xl font-extrabold leading-tight">{ch.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{ch.hint}</p>
              </div>
              <div className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/70 group-hover:text-primary transition-colors">
                Tune in <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ===================== MOOD BOARD ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-black mb-2">/ Mood index</p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Pick a feeling.</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {MOOD_TILES.map(m => (
            <button key={m.tag}
                    onClick={() => navigate(`/browse?genre=${encodeURIComponent(m.tag)}`)}
                    className={`relative aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br ${m.hue} group transition-transform hover:scale-[1.02]`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
              <div className="absolute inset-0 mix-blend-overlay opacity-30"
                   style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/80">{m.line}</p>
                <p className="text-xl sm:text-2xl font-black text-white drop-shadow-lg">{m.tag}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ===================== PILLARS ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-black mb-2">/ House rules</p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Six promises we keep.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PILLARS.map((p, i) => (
            <div key={p.title} className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-6 hover:border-primary/40 transition-colors">
              <span className="absolute top-4 right-5 text-[10px] font-black tracking-[0.3em] text-primary/40">0{i + 1}</span>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-primary/15 border border-primary/20">
                <p.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold mb-1.5">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== TIMELINE ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-black mb-2">/ First 20 seconds</p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">From tap to first frame.</h2>
        </div>
        <div className="relative">
          <div className="absolute left-0 right-0 top-7 h-px bg-gradient-to-r from-primary/50 via-border to-transparent hidden md:block" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {TIMELINE.map((s, i) => (
              <div key={s.t} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-primary/60 bg-background font-black text-sm tabular-nums">
                    {s.t}
                  </span>
                </div>
                <p className="text-base font-extrabold">{s.label}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== SPECS + STATS ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          {/* Spec sheet */}
          <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur overflow-hidden">
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-black">/ Spec sheet</p>
                <h3 className="text-xl font-extrabold mt-0.5">Under the hood</h3>
              </div>
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <dl className="divide-y divide-border/30">
              {SPECS.map(s => (
                <div key={s.k} className="flex items-center justify-between px-6 py-3.5 text-sm hover:bg-card/40 transition-colors">
                  <dt className="text-muted-foreground font-semibold uppercase text-[11px] tracking-[0.15em]">{s.k}</dt>
                  <dd className="font-bold tabular-nums">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live counters */}
          <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-6 flex flex-col justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-black">/ Right now</p>
              <h3 className="text-xl font-extrabold mt-0.5">The signal is hot.</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              {[
                { v: totalAnime || 500,                 s: '+', l: 'Titles aired',  i: Film },
                { v: totalEpisodes || 15000,            s: '+', l: 'Episodes ready', i: Play },
                { v: '24/7',                            s: '',  l: 'Free streaming', i: Radio },
                { v: 0,                                 s: '',  l: 'Ads. Ever.',     i: Shield },
              ].map(({ v, s, l, i: I }) => (
                <div key={l} className="rounded-xl bg-background/40 border border-border/30 p-4">
                  <I className="w-4 h-4 text-primary mb-2" />
                  <p className="text-3xl font-black tabular-nums leading-none">
                    {typeof v === 'number' ? v.toLocaleString() : v}{s}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-2">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== VOICES ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-black mb-2">/ From the audience</p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">What watchers say.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VOICES.map(v => (
            <figure key={v.who} className="relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur p-6">
              <span className="absolute top-3 right-4 text-5xl leading-none font-black text-primary/20">"</span>
              <blockquote className="text-base sm:text-lg font-semibold leading-snug text-foreground/90">
                {v.line}
              </blockquote>
              <figcaption className="mt-4 text-[11px] uppercase tracking-[0.25em] font-bold text-muted-foreground">
                — {v.who}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ===================== DEVICES ===================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-10 pb-24">
        <div className="rounded-3xl border border-border/40 bg-card/40 backdrop-blur overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
            <div className="p-8 sm:p-10 border-b md:border-b-0 md:border-r border-border/30">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-black">/ Everywhere</p>
              <h3 className="text-3xl font-black tracking-tight mt-2">Same channel, every screen.</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-md">
                Pin AnimeSavi to your home screen and it behaves like a native app —
                push alerts, offline downloads, lock-screen controls, and AirPlay
                straight to the TV.
              </p>
              <button onClick={() => startWatching('/')}
                      className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:scale-[1.03] transition-transform">
                Start Watching <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {[
                { i: Smartphone, t: 'iOS',     d: 'Safari + PWA' },
                { i: Smartphone, t: 'Android', d: 'Chrome install' },
                { i: Monitor,    t: 'Desktop', d: 'PiP + shortcuts' },
                { i: Tv,         t: 'TV',      d: 'AirPlay + cast' },
              ].map(({ i: I, t, d }) => (
                <div key={t} className="p-6 text-center border-t border-l border-border/20 first:border-l-0 md:first:border-l md:border-t-0 hover:bg-card/40 transition-colors">
                  <I className="w-7 h-7 text-primary mx-auto mb-2" />
                  <p className="text-sm font-extrabold">{t}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-border/30 py-10 px-4 sm:px-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src={logo} alt="" className="w-6 h-6 rounded-md" />
          <span className="font-black tracking-tight">
            <span className="text-primary">ANIME</span><span className="text-foreground">SAVI</span>
          </span>
          <span className="ml-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 font-bold">/ EST. 2024</span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © 2026 AnimeSavi — India's ad-free anime broadcast.
        </p>
      </footer>

      {/* =====================================================
           LIQUID-GLASS LAUNCH LOADER
         ===================================================== */}
      {isLaunching && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden animate-fade-in px-5 as-loader-bg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="as-launch-title"
          aria-describedby="as-launch-status"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Drifting glass orbs for liquid feel */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-[60vw] h-[60vw] max-w-[520px] max-h-[520px] rounded-full opacity-60"
                 style={{ background: 'radial-gradient(circle, hsl(var(--primary)/0.45), transparent 65%)', filter: 'blur(60px)', animation: 'as-orb 14s ease-in-out infinite' }} />
            <div className="absolute -bottom-32 -right-20 w-[55vw] h-[55vw] max-w-[480px] max-h-[480px] rounded-full opacity-55"
                 style={{ background: 'radial-gradient(circle, hsl(330 85% 55% / 0.5), transparent 65%)', filter: 'blur(70px)', animation: 'as-orb 18s ease-in-out -4s infinite reverse' }} />
            <div className="absolute top-1/3 right-1/4 w-[36vw] h-[36vw] max-w-[320px] max-h-[320px] rounded-full opacity-45"
                 style={{ background: 'radial-gradient(circle, hsl(220 90% 60% / 0.45), transparent 65%)', filter: 'blur(55px)', animation: 'as-orb 12s ease-in-out -8s infinite' }} />
          </div>

          {/* Glass card */}
          <div
            className="relative w-full max-w-md rounded-[28px] overflow-hidden p-6 sm:p-8 flex flex-col items-center gap-6 animate-scale-in"
            style={{
              background: 'linear-gradient(135deg, hsl(0 0% 100% / 0.10), hsl(0 0% 100% / 0.04))',
              border: '1px solid hsl(0 0% 100% / 0.14)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              boxShadow: '0 30px 80px hsl(0 0% 0% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25), inset 0 -1px 0 hsl(0 0% 0% / 0.3)',
            }}
          >
            {/* highlight sheen */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="pointer-events-none absolute inset-0 rounded-[28px]"
                 style={{ background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.08), transparent 40%)' }} />

            {/* Logo with glass ring */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-70"
                   style={{ background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(330 85% 60%), hsl(220 90% 60%), hsl(var(--primary)))', animation: 'spin 4s linear infinite' }} />
              <div className="relative h-20 w-20 rounded-full flex items-center justify-center"
                   style={{
                     background: 'linear-gradient(135deg, hsl(0 0% 100% / 0.15), hsl(0 0% 100% / 0.04))',
                     border: '1px solid hsl(0 0% 100% / 0.25)',
                     backdropFilter: 'blur(20px)',
                     WebkitBackdropFilter: 'blur(20px)',
                     boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.3), 0 10px 30px hsl(var(--primary)/0.35)',
                   }}>
                <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <h2 id="as-launch-title" className="text-xl sm:text-2xl font-black tracking-tight">
                <span className="text-primary">ANIME</span>SAVI
              </h2>
              <p className="text-[11px] uppercase tracking-[0.35em] font-bold text-foreground/70 flex items-center justify-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span aria-hidden="true">{launchBeat}</span>
              </p>
              {/* Polite live region announces progress to screen readers */}
              <p id="as-launch-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {launchError ? launchError : `${launchBeat}. ${Math.floor(launchProgress)} percent complete.`}
              </p>
            </div>

            {/* Glass progress track */}
            <div className="w-full space-y-2">
              <div
                className="relative h-2 w-full rounded-full overflow-hidden"
                style={{
                  background: 'hsl(0 0% 100% / 0.08)',
                  border: '1px solid hsl(0 0% 100% / 0.12)',
                  boxShadow: 'inset 0 1px 2px hsl(0 0% 0% / 0.4)',
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${launchProgress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(330 85% 65%), hsl(220 90% 65%), hsl(var(--primary)))',
                    backgroundSize: '300% 100%',
                    animation: 'as-shimmer 2.4s linear infinite',
                    boxShadow: '0 0 16px hsl(var(--primary)/0.7), inset 0 1px 0 hsl(0 0% 100% / 0.4)',
                    transition: 'width 220ms ease-out',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold tabular-nums uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(142_72%_45%)]" />
                  Connected
                </span>
                <span className="text-foreground/80">{Math.floor(launchProgress)}%</span>
              </div>
            </div>

            {/* Error */}
            {launchError && (
              <div className="w-full rounded-2xl p-4 space-y-3 animate-fade-in"
                   style={{
                     background: 'hsl(0 70% 50% / 0.12)',
                     border: '1px solid hsl(0 70% 50% / 0.35)',
                     backdropFilter: 'blur(20px)',
                     WebkitBackdropFilter: 'blur(20px)',
                   }}>
                <p className="text-xs sm:text-sm text-foreground/90 leading-snug text-left">{launchError}</p>
                <div className="flex gap-2">
                  <button onClick={retryLaunch} className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">Retry</button>
                  <button onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                          className="flex-1 h-9 rounded-xl border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes as-marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-33.333%) } }
        @keyframes as-shimmer { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
        @keyframes as-orb     { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(4%, -3%) scale(1.08) } }

        /* Liquid-glass loader background — desktop uses heavy backdrop blur,
           mobile (iOS/Android) drops to a lighter blur + opaque-ish base for
           smooth 60fps on weaker GPUs. */
        .as-loader-bg {
          background:
            radial-gradient(ellipse at 20% 10%, hsl(var(--primary)/0.28), transparent 55%),
            radial-gradient(ellipse at 80% 90%, hsl(330 85% 55% / 0.22), transparent 55%),
            radial-gradient(ellipse at 60% 40%, hsl(220 80% 55% / 0.18), transparent 60%),
            hsl(var(--background)/0.92);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
        }
        @media (max-width: 768px) {
          .as-loader-bg {
            background:
              radial-gradient(ellipse at 20% 10%, hsl(var(--primary)/0.32), transparent 55%),
              radial-gradient(ellipse at 80% 90%, hsl(330 85% 55% / 0.25), transparent 55%),
              hsl(var(--background));
            backdrop-filter: blur(14px) saturate(140%);
            -webkit-backdrop-filter: blur(14px) saturate(140%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .as-loader-bg [style*="as-orb"],
          .as-loader-bg [style*="as-shimmer"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
