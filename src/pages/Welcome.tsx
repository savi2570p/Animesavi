import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Play, ChevronRight, Radio, Tv, Film, Shield, Zap, Bell,
  Globe, Download, Monitor, Smartphone, Users, ArrowRight,
  PlayCircle, Flame, TrendingUp, Sparkles,
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

/* ---------- Static content ---------- */

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

const TRENDING_SEARCHES = [
  'Solo Leveling', 'Demon Slayer', 'Dandadan', 'Frieren',
  'Jujutsu Kaisen', 'Chainsaw Man', 'Re:Zero',
];

const PILLARS = [
  { icon: Shield,   title: 'Zero Ads, Zero Walls', body: 'No banners, no preroll, no premium tier hiding episodes. Every feature, free, forever.' },
  { icon: Globe,    title: 'Official Hindi Dub',   body: 'Hindi alongside English & Japanese — switch tracks mid-episode without reloading the player.' },
  { icon: Zap,      title: 'Sub-second Start',     body: 'H.Savi, Multi.Savi and X-PLUS pre-warm. Tap play and the first frame lands in under a second.' },
  { icon: Download, title: 'Real 4K Downloads',    body: 'Save 480p → 2160p with clean episode names, codec tag and audio language in the filename.' },
  { icon: Users,    title: 'Watch Parties + Chat', body: 'Sync playback with friends, react in a live chat sidebar, resume where the party left off.' },
  { icon: Bell,     title: 'Heads-up Alerts',      body: 'A push exactly one hour before your favourite show airs — perfectly timed, never spammy.' },
];

const LOADER_BEATS = [
  { at: 0,   label: 'Tuning signal' },
  { at: 24,  label: 'Warming servers' },
  { at: 48,  label: 'Loading catalog' },
  { at: 70,  label: 'Color graded' },
  { at: 88,  label: 'Audio synced' },
  { at: 100, label: 'On air' },
];

export default function Welcome() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [featuredAnime, setFeaturedAnime] = useState<AnimePreview[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [totalAnime, setTotalAnime] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [clock, setClock] = useState(() => new Date());

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchBeat, setLaunchBeat] = useState(LOADER_BEATS[0].label);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchTarget, setLaunchTarget] = useState<string>('/');

  /* ---------- Guarantee scrolling (dialogs elsewhere can lock <body>) ---------- */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const restore = () => {
      body.classList.remove('clone-mode');
      body.style.overflow = '';
      body.style.overflowY = 'auto';
      body.style.position = '';
      body.style.height = '';
      body.style.pointerEvents = '';
      html.style.overflow = '';
      html.style.overflowY = 'auto';
    };
    restore();
    const id = window.setInterval(restore, 600);
    return () => {
      window.clearInterval(id);
      body.style.overflowY = '';
      html.style.overflowY = '';
    };
  }, []);

  /* ---------- Data ---------- */
  useEffect(() => {
    (async () => {
      const FEATURED_TITLES = [
        'Solo Leveling', 'Demon Slayer', 'Frieren', 'Dandadan',
        'That Time I Got Reincarnated as a Slime',
      ];
      const { data: curated } = await supabase
        .from('anime')
        .select('id, title, cover_image, banner_image, genres, view_count')
        .or(FEATURED_TITLES.map(t => `title.ilike.%${t.slice(0, 40)}%`).join(','))
        .limit(8);
      let list = curated || [];
      if (list.length < 4) {
        const { data: fb } = await supabase
          .from('anime').select('id, title, cover_image, banner_image, genres, view_count')
          .eq('is_featured', true).neq('title', 'Jujutsu Kaisen').limit(8);
        const seen = new Set(list.map(a => a.id));
        list = [...list, ...((fb || []).filter(a => !seen.has(a.id)))];
      }
      if (list.length) setFeaturedAnime(list.slice(0, 4));

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
    const id = setInterval(() => setActiveIndex(p => (p + 1) % featuredAnime.length), 4600);
    return () => clearInterval(id);
  }, [featuredAnime.length]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- Launch sequence ---------- */
  const startWatching = useCallback((target: string = '/') => {
    setLaunchTarget(target);
    setLaunchError(null);
    setLaunchProgress(0);
    setLaunchBeat(LOADER_BEATS[0].label);
    setIsLaunching(true);
  }, []);

  useEffect(() => {
    if (!isLaunching) return;
    const start = performance.now();
    const duration = 2100;
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
        }, 240);
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
      className="wlc2-page relative w-full text-foreground"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* ===================== AURORA BACKDROP ===================== */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {hero?.cover_image && (
          <img
            key={hero.id}
            src={hero.cover_image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top opacity-[0.22]"
            style={{ transition: 'opacity 600ms ease' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        <div className="absolute -left-32 top-[-10%] h-[70vw] w-[70vw] max-h-[560px] max-w-[560px] rounded-full opacity-50"
             style={{ background: 'radial-gradient(circle, hsl(var(--primary)/0.5), transparent 65%)', filter: 'blur(70px)', animation: 'wlc2-orb 16s ease-in-out infinite' }} />
        <div className="absolute -right-32 top-[30%] h-[60vw] w-[60vw] max-h-[480px] max-w-[480px] rounded-full opacity-40"
             style={{ background: 'radial-gradient(circle, hsl(300 85% 55% / 0.5), transparent 65%)', filter: 'blur(80px)', animation: 'wlc2-orb 20s ease-in-out -5s infinite reverse' }} />
        <div className="absolute bottom-[-20%] left-[25%] h-[50vw] w-[50vw] max-h-[420px] max-w-[420px] rounded-full opacity-30"
             style={{ background: 'radial-gradient(circle, hsl(220 90% 55% / 0.5), transparent 65%)', filter: 'blur(90px)', animation: 'wlc2-orb 22s ease-in-out -10s infinite' }} />
      </div>

      {/* ===================== FLOATING GLASS NAV ===================== */}
      <header className="sticky top-3 z-40 mx-auto max-w-5xl px-4 sm:px-6">
        <div className="wlc2-glass flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="wlc2-logo-ring flex h-9 w-9 items-center justify-center rounded-xl">
              <img src={logo} alt="AnimeSavi" className="h-6 w-6 rounded-lg object-contain" />
            </div>
            <div className="min-w-0 leading-none">
              <p className="truncate text-sm sm:text-base font-black tracking-tight">
                <span className="text-primary">ANIME</span>SAVI
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-muted-foreground/80 font-semibold">
                Free anime broadcast · India
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="wlc2-chip hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-70" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-rose-500" />
              </span>
              Live · {timeStr} IST
            </span>
            <button
              onClick={() => startWatching('/')}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.04]"
              style={{ boxShadow: '0 10px 30px hsl(var(--primary)/0.45), inset 0 1px 0 hsl(0 0% 100%/0.3)' }}
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <PlayCircle className="relative h-4 w-4 fill-current" />
              <span className="relative hidden sm:inline">Start Watching</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-12 sm:pt-20 pb-10 text-center">
        <div className="wlc2-chip mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em] text-foreground/80">
            Free forever · No signup · No ads
          </span>
        </div>

        <h1 className="font-black leading-[0.95] tracking-tight text-[clamp(2.4rem,8vw,5.2rem)]">
          <span className="block">Anime, the way</span>
          <span className="block bg-gradient-to-r from-primary via-rose-400 to-fuchsia-500 bg-clip-text text-transparent">
            it should air.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm sm:text-base leading-relaxed text-foreground/75">
          Official Hindi dubs, true 4K UHD playback, multi-server streaming and real
          offline downloads — wrapped in a player built for phones, tablets and the big screen.
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-xl">
          <div className="wlc2-glass relative flex items-center rounded-2xl">
            <Search className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search a title, a genre, a vibe…"
              aria-label="Search anime"
              className="w-full rounded-2xl bg-transparent py-3.5 pl-12 pr-28 text-sm sm:text-base placeholder:text-muted-foreground/70 focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Search
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80">
              <TrendingUp className="h-3 w-3 text-primary" /> Trending
            </span>
            {TRENDING_SEARCHES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => navigate(`/browse?q=${encodeURIComponent(t)}`)}
                className="wlc2-chip rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
              >
                {t}
              </button>
            ))}
          </div>
        </form>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => startWatching('/')}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-2xl bg-primary px-8 py-3.5 text-sm sm:text-base font-black uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.04]"
            style={{ boxShadow: '0 16px 44px hsl(var(--primary)/0.5), inset 0 1px 0 hsl(0 0% 100%/0.3)' }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <PlayCircle className="relative h-5 w-5 fill-current" />
            <span className="relative">Start Watching</span>
          </button>
          <button
            onClick={() => navigate('/browse')}
            className="wlc2-chip group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm sm:text-base font-bold"
          >
            Browse Catalog
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { v: totalAnime || 500,      s: '+', l: 'Titles aired',   i: Film },
            { v: totalEpisodes || 15000, s: '+', l: 'Episodes ready', i: Play },
            { v: '24/7',                 s: '',  l: 'Free streaming', i: Radio },
            { v: 0,                      s: '',  l: 'Ads. Ever.',     i: Shield },
          ].map(({ v, s, l, i: I }) => (
            <div key={l} className="wlc2-glass rounded-2xl px-3 py-4 text-center">
              <I className="mx-auto mb-2 h-4 w-4 text-primary" />
              <p className="text-xl sm:text-2xl font-black leading-none tabular-nums">
                {typeof v === 'number' ? v.toLocaleString() : v}{s}
              </p>
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== TRENDING SHOWCASE ===================== */}
      {featuredAnime.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-12">
          <div className="wlc2-glass rounded-[28px] p-3.5 sm:p-5">
            <div className="mb-3.5 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em]">
                <Flame className="h-3.5 w-3.5 text-primary" /> Trending now
              </span>
              <button
                onClick={() => navigate('/schedule')}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
              >
                Full schedule <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '16 / 9' }}>
              {featuredAnime.map((a, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={a.id}
                    onClick={() => (active ? navigate(`/anime/${a.id}`) : setActiveIndex(i))}
                    aria-label={a.title}
                    aria-hidden={!active}
                    tabIndex={active ? 0 : -1}
                    className="absolute inset-0 text-left"
                    style={{
                      opacity: active ? 1 : 0,
                      transition: 'opacity 380ms cubic-bezier(0.22,1,0.36,1)',
                      pointerEvents: active ? 'auto' : 'none',
                    }}
                  >
                    {a.cover_image ? (
                      <img
                        src={(a as any).banner_image || a.cover_image}
                        alt={a.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/60 to-accent/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                      <span className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-primary/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-foreground">
                        #{i + 1} Trending
                      </span>
                      <p className="truncate text-base sm:text-2xl font-black text-white">{a.title}</p>
                      <p className="mt-0.5 truncate text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-white/70">
                        {(a.genres || []).slice(0, 3).join(' · ') || 'Now streaming'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Slim bar pagination */}
            <div className="mt-3.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Trending pagination">
              {featuredAnime.map((_, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={active}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setActiveIndex(i)}
                    style={{
                      height: 3,
                      width: active ? 34 : 18,
                      borderRadius: 999,
                      background: active
                        ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(300 85% 60%))'
                        : 'rgba(255,255,255,0.2)',
                      transition: 'width 320ms cubic-bezier(0.22,1,0.36,1), background 320ms ease',
                      padding: 0,
                      border: 0,
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================== TICKER ===================== */}
      <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.03]">
        <div className="flex gap-10 whitespace-nowrap py-2.5" style={{ animation: 'wlc2-marquee 38s linear infinite' }}>
          {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-foreground/70">
              <span className="h-1 w-1 rounded-full bg-primary" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ===================== PILLARS — bento ===================== */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
        <div className="mb-8 text-center">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary">/ House rules</p>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Six promises we keep.</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <div key={p.title} className="wlc2-glass group relative rounded-2xl p-5 sm:p-6">
              <span className="absolute right-5 top-4 text-[10px] font-black tracking-[0.3em] text-primary/40">0{i + 1}</span>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-1.5 text-base sm:text-lg font-extrabold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== EVERYWHERE ===================== */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
        <div className="wlc2-glass rounded-[28px] p-6 sm:p-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">/ Everywhere</p>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Same channel, every screen.</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Pin AnimeSavi to your home screen and it behaves like a native app —
            push alerts, offline downloads, lock-screen controls and AirPlay to the TV.
          </p>
          <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { i: Smartphone, t: 'iOS',     d: 'Safari PWA' },
              { i: Smartphone, t: 'Android', d: 'Chrome' },
              { i: Monitor,    t: 'Desktop', d: 'PiP' },
              { i: Tv,         t: 'TV',      d: 'AirPlay' },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="wlc2-chip rounded-xl p-3.5 text-center">
                <I className="mx-auto mb-1.5 h-5 w-5 text-primary" />
                <p className="text-xs font-extrabold">{t}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => startWatching('/')}
            className="group relative mt-8 inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary px-8 py-3.5 text-sm font-black uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03]"
            style={{ boxShadow: '0 14px 40px hsl(var(--primary)/0.45), inset 0 1px 0 hsl(0 0% 100%/0.3)' }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            Start Watching <ArrowRight className="relative h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-white/10 px-4 sm:px-6 py-9 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <img src={logo} alt="" className="h-6 w-6 rounded-md" />
          <span className="font-black tracking-tight">
            <span className="text-primary">ANIME</span>SAVI
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60">© 2026 AnimeSavi — India's ad-free anime broadcast.</p>
      </footer>

      {/* ===================== LAUNCH LOADER ===================== */}
      {isLaunching && (
        <div
          className="wlc2-loader-bg fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-5 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="as-launch-title"
          aria-describedby="as-launch-status"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-[55vw] max-h-[460px] w-[55vw] max-w-[460px] rounded-full opacity-60"
                 style={{ background: 'radial-gradient(circle, hsl(var(--primary)/0.45), transparent 65%)', filter: 'blur(60px)', animation: 'wlc2-orb 14s ease-in-out infinite' }} />
            <div className="absolute -bottom-28 -right-20 h-[50vw] max-h-[420px] w-[50vw] max-w-[420px] rounded-full opacity-55"
                 style={{ background: 'radial-gradient(circle, hsl(300 85% 55% / 0.5), transparent 65%)', filter: 'blur(70px)', animation: 'wlc2-orb 18s ease-in-out -4s infinite reverse' }} />
          </div>

          <div className="wlc2-loader-card relative flex w-full max-w-sm flex-col items-center gap-6 rounded-[26px] p-6 sm:p-7 animate-scale-in">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

            <div className="relative">
              <div className="absolute inset-0 rounded-full opacity-70 blur-xl"
                   style={{ background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(300 85% 60%), hsl(220 90% 60%), hsl(var(--primary)))', animation: 'spin 4s linear infinite' }} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/[0.08]">
                <img src={logo} alt="" className="h-10 w-10 rounded-xl object-contain" />
              </div>
            </div>

            <div className="space-y-1.5 text-center">
              <h2 id="as-launch-title" className="text-lg sm:text-xl font-black tracking-tight">
                <span className="text-primary">ANIME</span>SAVI
              </h2>
              <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/70">
                <span className="h-1 w-1 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span aria-hidden="true">{launchBeat}</span>
              </p>
              <p id="as-launch-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {launchError ? launchError : `${launchBeat}. ${Math.floor(launchProgress)} percent complete.`}
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.08]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${launchProgress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(300 85% 65%), hsl(220 90% 65%), hsl(var(--primary)))',
                    backgroundSize: '300% 100%',
                    animation: 'wlc2-shimmer 2.4s linear infinite',
                    boxShadow: '0 0 14px hsl(var(--primary)/0.6)',
                    transition: 'width 200ms ease-out',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider tabular-nums text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
                <span className="text-foreground/80">{Math.floor(launchProgress)}%</span>
              </div>
            </div>

            {launchError && (
              <div className="w-full space-y-3 rounded-2xl border border-destructive/35 bg-destructive/10 p-4 animate-fade-in">
                <p className="text-left text-xs leading-snug text-foreground/90">{launchError}</p>
                <div className="flex gap-2">
                  <button onClick={retryLaunch} className="h-9 flex-1 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90">Retry</button>
                  <button onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                          className="h-9 flex-1 rounded-xl border border-white/20 bg-white/5 text-xs font-semibold hover:bg-white/10">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wlc2-marquee { 0% { transform: translateX(0) } 100% { transform: translateX(-33.333%) } }
        @keyframes wlc2-shimmer { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
        @keyframes wlc2-orb     { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(4%, -3%) scale(1.06) } }
      `}</style>
    </div>
  );
}
