import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Globe, MonitorPlay, Play, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeSearchHero } from '@/components/home/HomeSearchHero';
import { supabase } from '@/integrations/supabase/client';

interface Poster {
  id: string;
  title: string;
  cover_image: string | null;
}

const FEATURES = [
  { icon: Globe, title: 'Hindi, English & Japanese', body: 'Hindi DUB first, with English dubs and Japanese audio where available. Switch audio from the player.' },
  { icon: MonitorPlay, title: 'Up to 4K playback', body: 'Pick the quality you want, up to 4K. What you get depends on the episode, your connection and device.' },
  { icon: Download, title: 'Downloads & offline', body: 'Save supported episodes and watch them later from the Downloads page, even without a connection.' },
  { icon: Users, title: 'Watch parties', body: 'Watch in sync with friends and chat live while the host controls playback.' },
];

const FAQ = [
  { q: 'Which audio and subtitles are available?', a: 'Look for the audio badges on each title. Available tracks and captions depend on the episode and selected server; not every title has every language.' },
  { q: 'What does signing in add?', a: 'Your account brings together favourites, watch-list titles and watching history. Continue Watching uses saved progress where the player supports it.' },
  { q: 'Why can playback or quality vary?', a: 'Each server and source can offer different formats and qualities. Your connection and device also affect playback. You can choose another available server manually.' },
  { q: 'Can I watch offline?', a: 'Offline saving is available for supported episodes. Keep enough free device storage and use the Downloads page to find saved content.' },
  { q: 'Do I need an account to watch?', a: 'You can browse and watch without signing in. An account adds favourites, watch-list titles, watching history and Continue Watching progress.' },
  { q: 'How do I hear about new episodes?', a: 'Join the Telegram channel or allow browser notifications. Favourite anime can send an alert about an hour before a scheduled release, and you can turn these off in Settings.' },
  { q: 'What should I do if an episode will not play?', a: 'Pick another server in the player and reload the page. Sources differ per episode, so switching servers manually is usually enough.' },
  { q: 'Can I cast or mirror to a TV?', a: 'You can cast or mirror from a phone, tablet or computer. Simple Mode strips the custom overlays for a cleaner picture on the big screen.' },
  { q: 'Is my watching history saved?', a: 'Progress is stored with your account so you can resume episodes and see Continue Watching. You can clear history from your account pages.' },
];

const SectionLabel = ({ children }: { children: string }) => (
  <p className="welcome-plus-label text-[10px] font-bold uppercase text-primary">{children}</p>
);

const PosterImg = ({ poster, className = '' }: { poster?: Poster; className?: string }) => (
  <div className={`welcome-plus-poster ${className}`}>
    {poster?.cover_image && <img src={poster.cover_image} alt={poster.title} loading="lazy" decoding="async" />}
  </div>
);

export default function Welcome() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [totals, setTotals] = useState<{ anime: number; episodes: number }>({ anime: 0, episodes: 0 });

  /* Guarantee scrolling (dialogs elsewhere can lock <body>) */
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, { count: animeCount }, { count: episodeCount }] = await Promise.all([
        supabase.from('anime').select('id, title, cover_image').not('cover_image', 'is', null).order('view_count', { ascending: false }).limit(12),
        supabase.from('anime').select('id', { count: 'exact', head: true }),
        supabase.from('episodes').select('id', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      setPosters((data as Poster[]) || []);
      setTotals({ anime: animeCount || 0, episodes: episodeCount || 0 });
    })();
    return () => { cancelled = true; };
  }, []);

  const p = (i: number) => posters[i % Math.max(posters.length, 1)];

  return (
    <div className="welcome-plus min-h-screen text-foreground">
      <HomeSearchHero plusBrand watchHref="/" headline="Watch Anime in Hindi DUB" />

      {/* About */}
      <section className="container max-w-5xl py-14 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <SectionLabel>About AnimeSavi+</SectionLabel>
          <h2 className="mt-3 font-heading text-2xl md:text-3xl font-medium leading-snug">
            A calm, fast home for anime <span className="text-primary">in your own language.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Anime is more than a show — it is the story you can&apos;t stop thinking about, the fight you replay and the ending you never forget. Millions of fans grew up with it, and many of them want to hear it in Hindi.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            AnimeSavi+ keeps things simple: find a title, press play and watch. Hindi DUB episodes, English dubs and subtitled releases sit side by side, with your progress saved so you can pick up where you left off.
          </p>
        </div>
        <div className="welcome-plus-stack relative mx-auto h-[300px] w-[260px] md:h-[340px] md:w-[300px]" aria-hidden>
          <PosterImg poster={p(0)} className="is-back" />
          <PosterImg poster={p(1)} className="is-mid" />
          <PosterImg poster={p(2)} className="is-front" />
          <span className="welcome-plus-dot is-a" /><span className="welcome-plus-dot is-b" />
        </div>
      </section>

      {/* Why */}
      <section className="container max-w-5xl py-14 md:py-20 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="welcome-plus-collage relative mx-auto h-[300px] w-full max-w-[380px] order-2 md:order-1" aria-hidden>
          <PosterImg poster={p(3)} className="is-left" />
          <PosterImg poster={p(4)} className="is-center" />
          <PosterImg poster={p(5)} className="is-right" />
          <div className="welcome-plus-badge absolute flex items-center gap-2.5 px-3 py-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary"><Star className="h-3.5 w-3.5 fill-current" /></span>
            <span className="leading-tight"><span className="block text-[10px] text-muted-foreground">Top quality</span><span className="block text-xs font-semibold">Up to 4K</span></span>
          </div>
        </div>
        <div className="order-1 md:order-2">
          <SectionLabel>Why AnimeSavi+?</SectionLabel>
          <h2 className="mt-3 font-heading text-2xl md:text-3xl font-medium leading-snug">
            Built for <span className="text-primary">smooth playback</span> and easy watching.
          </h2>
          <ul className="mt-6 space-y-5">
            {FEATURES.map(f => (
              <li key={f.title} className="flex gap-3.5">
                <span className="welcome-plus-icon grid h-9 w-9 shrink-0 place-items-center"><f.icon className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Library */}
      <section className="container max-w-5xl py-14 md:py-20 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <SectionLabel>Growing library</SectionLabel>
          <h2 className="mt-3 font-heading text-2xl md:text-3xl font-medium leading-snug">
            Every genre, every mood. <span className="text-primary">All in one place.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            From this season&apos;s new episodes to finished classics and anime movies, everything is organised by genre, audio and release day so the next thing to watch is always a tap away.
          </p>
          {(totals.anime > 0 || totals.episodes > 0) && (
            <dl className="mt-6 flex gap-8">
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Titles</dt><dd className="font-heading text-2xl font-bold tabular-nums">{totals.anime.toLocaleString()}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Episodes</dt><dd className="font-heading text-2xl font-bold tabular-nums">{totals.episodes.toLocaleString()}</dd></div>
            </dl>
          )}
          <Link to="/browse" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold hover:text-primary">Explore the catalog <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="welcome-plus-mosaic relative overflow-hidden aspect-square w-full max-w-[380px] mx-auto" aria-hidden>
          <div className="welcome-plus-mosaic-grid grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => <PosterImg key={i} poster={p(i + 3)} />)}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container max-w-3xl py-14 md:py-20 welcome-info-v13">
        <SectionLabel>Good to know</SectionLabel>
        <h2 className="mt-3 mb-6 font-heading text-2xl md:text-3xl font-medium">Questions, answered.</h2>
        {FAQ.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild><a href="https://t.me/AnimeSaviInhindiDUB" target="_blank" rel="noopener noreferrer"><Users className="h-4 w-4" />Telegram community</a></Button>
          <Button variant="outline" onClick={() => window.open('https://youtube.com/@anime-savi-official?si=4hhAJLdVctT1s6WL', '_blank', 'noopener,noreferrer')}><Play className="h-4 w-4" />Subscribe for more updates</Button>
        </div>
      </section>

      <footer className="container max-w-5xl border-t border-border py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>© 2026 AnimeSavi+</span>
        <Link to="/" className="inline-flex items-center gap-1.5 hover:text-foreground">Start watching <ArrowRight className="h-3.5 w-3.5" /></Link>
      </footer>
    </div>
  );
}
