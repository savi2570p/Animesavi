import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Play, ChevronRight, Radio, Tv, Film, Shield, Zap, Bell,
  Globe, Download, Monitor, Smartphone, Users, ArrowRight,
  PlayCircle, Flame, TrendingUp, Sparkles,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DubBadge } from '@/components/anime/DubBadge';
import { supabase } from '@/integrations/supabase/client';

interface AnimePreview {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image?: string | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
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
        .select('id, title, cover_image, banner_image, genres, view_count, is_eng_dub, is_sub_only')
        .or(FEATURED_TITLES.map(t => `title.ilike.%${t.slice(0, 40)}%`).join(','))
        .limit(8);
      let list = curated || [];
      if (list.length < 4) {
        const { data: fb } = await supabase
          .from('anime').select('id, title, cover_image, banner_image, genres, view_count, is_eng_dub, is_sub_only')
          .eq('is_featured', true).neq('title', 'My Hero Academia').limit(8);
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
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setActiveIndex(p => (p + 1) % featuredAnime.length);
      }
    }, 6000);
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
    <div className="welcome-v5 min-h-screen text-foreground">
      <header className="welcome-v5-nav absolute inset-x-0 top-0 z-20">
        <div className="container flex items-center justify-between gap-4 py-4 sm:py-5">
          <div className="flex items-center gap-2.5"><img src={logo} alt="" className="h-9 w-9 object-contain" /><span className="font-bold text-lg"><span className="text-primary">Anime</span>Savi</span></div>
          <Button variant="glass" onClick={() => startWatching('/')}><Play className="h-4 w-4" />Watch now</Button>
        </div>
      </header>

      <section className="welcome-v5-hero relative overflow-hidden">
        {hero && <img src={hero.banner_image || hero.cover_image || '/placeholder.svg'} alt={hero.title} className="welcome-v5-art absolute inset-0 h-full w-full object-cover" fetchPriority="high" />}
        <div className="welcome-v5-scrim absolute inset-0" aria-hidden="true" />
        <div className="container relative z-10 welcome-v5-copy">
          <div className="max-w-2xl">
            <span className="welcome-v5-label inline-flex items-center gap-2 text-xs mb-4"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Hindi · English · Japanese</span>
            <h1 className="text-5xl sm:text-7xl font-bold leading-none"><span className="text-primary">Anime</span>Savi</h1>
            <p className="text-sm sm:text-lg text-foreground/80 mt-5 max-w-md">Your next anime. Your favourite language.</p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button onClick={() => startWatching('/')} size="lg"><Play className="h-4 w-4 fill-current" />Start watching</Button>
              <Button variant="glass" size="lg" onClick={() => navigate('/browse')}>Browse anime<ArrowRight className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleSearch} className="welcome-v5-search flex items-center gap-2 mt-7 max-w-lg p-2">
              <Search className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
              <Input aria-label="Search anime" placeholder="Search anime…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="border-0 bg-transparent shadow-none focus-visible:ring-0 min-w-0" />
              <Button type="submit" variant="glass" size="icon" aria-label="Search"><ArrowRight className="h-4 w-4" /></Button>
            </form>
            {hero && <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="text-foreground/80 truncate max-w-full">{hero.title}</span><DubBadge isEngDub={hero.is_eng_dub} isSubOnly={hero.is_sub_only} genres={hero.genres} /></div>}
          </div>
        </div>
        <div className="container relative z-10 pb-5 flex items-center gap-2">
          {featuredAnime.map((a, i) => <Button key={a.id} variant="ghost" aria-label={`Feature ${a.title}`} aria-pressed={i === activeIndex} className="welcome-v5-pagination p-0 h-6 w-10" onClick={() => setActiveIndex(i)}><span className={i === activeIndex ? 'bg-primary' : 'bg-muted-foreground/40'} /></Button>)}
        </div>
      </section>

      <section className="container py-7 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-bold text-xl sm:text-2xl flex items-center gap-2"><Flame className="h-5 w-5 text-primary" />Trending now</h2><Button variant="ghost" size="sm" onClick={() => navigate('/schedule')}>Schedule<ChevronRight className="h-4 w-4" /></Button></div>
        <div className="snap-row flex gap-4 overflow-x-auto pb-4">
          {featuredAnime.map(a => <Button asChild variant="ghost" key={a.id} className="welcome-v5-tile block h-auto p-0 shrink-0 text-left whitespace-normal"><a href={`/anime/${a.id}`} onClick={e => { e.preventDefault(); navigate(`/anime/${a.id}`); }}><div className="relative aspect-video overflow-hidden rounded-lg"><img src={a.banner_image || a.cover_image || '/placeholder.svg'} alt={a.title} className="h-full w-full object-cover" loading="lazy" /><div className="absolute top-2 right-2"><DubBadge isEngDub={a.is_eng_dub} isSubOnly={a.is_sub_only} genres={a.genres} /></div></div><div className="p-3"><h3 className="line-clamp-2 text-sm font-semibold min-h-10">{a.title}</h3><p className="text-xs text-muted-foreground mt-1 truncate">{(a.genres || []).slice(0, 2).join(' · ')}</p></div></a></Button>)}
        </div>
      </section>

      <section className="welcome-v5-band border-y border-border">
        <div className="container grid grid-cols-2 sm:grid-cols-4 py-7 gap-6">
          {[{value: totalAnime ? totalAnime.toLocaleString() : '—', label: 'Anime titles'}, {value: totalEpisodes ? totalEpisodes.toLocaleString() : '—', label: 'Episodes'}, {value: '4K', label: 'Ultra HD'}, {value: '3', label: 'Audio languages'}].map(stat => <div key={stat.label}><p className="text-2xl font-bold tabular-nums">{stat.value}</p><p className="text-xs mt-2 text-muted-foreground">{stat.label}</p></div>)}
        </div>
      </section>
      <section className="container py-10 sm:py-14 flex flex-wrap justify-between items-center gap-6">
        <div><h2 className="text-2xl font-bold">Find something worth watching.</h2><div className="mt-4 flex flex-wrap gap-2">{TRENDING_SEARCHES.slice(0, 4).map(t => <Button key={t} variant="glass" size="sm" onClick={() => navigate(`/browse?q=${encodeURIComponent(t)}`)}>{t}</Button>)}</div></div>
        <Button onClick={() => startWatching('/')} variant="glass">Open catalogue<ArrowRight className="h-4 w-4" /></Button>
      </section>
      <section className="welcome-info-v13">
        <div className="container py-10 sm:py-14">
          <h2 className="text-2xl font-bold mb-6">More from AnimeSavi</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
            {[
              { icon: Globe, title: 'Hindi, English & Japanese', body: 'Find Hindi-dubbed, English-dubbed and subtitled anime. Audio and subtitle availability varies by title and server.' },
              { icon: Tv, title: 'Series & movies', body: 'Explore anime by genre, discover recent episodes and find completed series and feature films.' },
              { icon: Bell, title: 'Release calendar', body: 'Check scheduled releases and follow favourite anime. Notifications depend on your browser permissions and available release information.' },
              { icon: PlayCircle, title: 'Your watching library', body: 'Keep favourites, save titles to your watch list and return to episodes in Continue Watching when signed in.' },
              { icon: Download, title: 'Downloads & offline viewing', body: 'Available episodes include download options. Offline viewing depends on supported sources, browser storage and your device.' },
              { icon: Monitor, title: 'Watch on your devices', body: 'Use AnimeSavi on phones, tablets and computers. Playback quality up to 4K depends on the source, connection and device.' },
            ].map(item => <article key={item.title}><item.icon className="h-6 w-6" /><h3 className="font-semibold text-base">{item.title}</h3><p className="text-sm leading-relaxed text-muted-foreground mt-2">{item.body}</p></article>)}
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <Button variant="glass" onClick={() => navigate('/auth')}><Users className="h-4 w-4" />Your account</Button>
            <Button variant="glass" onClick={() => navigate('/schedule')}><Bell className="h-4 w-4" />Release calendar</Button>
          </div>
        </div>
      </section>
      <section className="welcome-info-v13">
        <div className="container py-10 sm:py-14">
          <h2 className="text-2xl font-bold mb-6">Good to know</h2>
          {[
            { q: 'Which audio and subtitles are available?', a: 'Look for the audio badges on each title. Available tracks and captions depend on the episode and selected server; not every title has every language.' },
            { q: 'What does signing in add?', a: 'Your account brings together favourites, watch-list titles and watching history. Continue Watching uses saved progress where the player supports it.' },
            { q: 'Why can playback or quality vary?', a: 'Each server and source can offer different formats and qualities. Your connection and device also affect playback. You can choose another available server manually.' },
            { q: 'Can I watch offline?', a: 'Offline saving is available for supported episodes. Keep enough free device storage and use the Downloads page to find saved content.' },
          ].map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="glass" asChild><a href="https://t.me/animesavihindidub" target="_blank" rel="noopener noreferrer"><Users className="h-4 w-4" />Telegram community</a></Button>
            <Button variant="glass" onClick={() => window.open('https://youtube.com/@anime-savi-official?si=4hhAJLdVctT1s6WL', '_blank', 'noopener,noreferrer')}><Play className="h-4 w-4" />Subscribe for more updates</Button>
          </div>
        </div>
      </section>
      <footer className="container border-t border-border py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>© 2026 AnimeSavi</span><Button variant="ghost" size="sm" onClick={() => navigate('/browse')}>Browse<ArrowRight className="h-3.5 w-3.5" /></Button></footer>
      {isLaunching && <div className="detail-loading-v4 fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="launch-title">
        <div className="detail-loading-v4-panel rounded-lg p-6 w-full max-w-xs text-center">
          <img src={logo} alt="" className="h-12 w-12 mx-auto object-contain" />
          <h2 id="launch-title" className="text-lg font-bold mt-4">AnimeSavi</h2><p role="status" className="text-xs text-muted-foreground mt-2">{launchError || 'Opening catalogue…'}</p>
          <div className="detail-loading-v4-track mt-5"><span /></div>
          {launchError && <div className="flex gap-2 mt-4"><Button onClick={retryLaunch}>Retry</Button><Button variant="glass" onClick={() => setIsLaunching(false)}>Cancel</Button></div>}
        </div>
      </div>}
    </div>
  );
}
