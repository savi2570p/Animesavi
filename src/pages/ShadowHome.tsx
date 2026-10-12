import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Play, LogIn, LogOut, SlidersHorizontal, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const HOME_V2_EMAILS = ['savi2570p@gmail.com', 'shadowtoonsindia@gmail.com'];
type DubKind = 'H-DUB' | 'E-DUB' | 'SUB' | '18+';
const ALL_KINDS: DubKind[] = ['H-DUB', 'E-DUB', 'SUB', '18+'];
const isAdult = (a?: { genres?: string[] | null } | null) => !!a?.genres?.some((g) => g.toLowerCase() === 'hentai');
const kindOf = (a?: { is_eng_dub?: boolean; is_sub_only?: boolean; genres?: string[] | null } | null): DubKind =>
  a?.is_sub_only ? 'SUB' : a?.is_eng_dub ? 'E-DUB' : 'H-DUB';
import { DubBadge } from '@/components/anime/DubBadge';

interface Ep {
  id: string;
  episode_number: number;
  thumbnail: string | null;
  season: { season_number: number; anime: { title: string; cover_image: string | null; type: string | null; is_eng_dub?: boolean; is_sub_only?: boolean; genres?: string[] | null } | null } | null;
}

interface AnimeHit { id: string; title: string; cover_image: string | null; type?: string | null; is_eng_dub?: boolean; is_sub_only?: boolean; genres?: string[] | null }

export default function ShadowHome() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Ep[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AnimeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<AnimeHit[]>([]);
  const [tab, setTab] = useState<'series' | 'movies'>('series');
  const { user, signOut } = useAuth();
  const allowed = HOME_V2_EMAILS.includes((user?.email || '').toLowerCase());
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [kinds, setKinds] = useState<DubKind[]>(ALL_KINDS);
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'home_v2_show_types').maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.value)) { const v = data!.value as string[]; setKinds((v.includes('v2') ? v : [...v, '18+']).filter((x) => x !== 'v2') as DubKind[]); } });
  }, []);
  const toggleKind = (k: DubKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    setKinds(next);
    supabase.from('site_settings').upsert({ key: 'home_v2_show_types', value: [...next, 'v2'] as any }, { onConflict: 'key' })
      .then(({ error }) => { if (error) toast.error('Could not save: ' + error.message); });
  };
  const visible = (a?: any) => (isAdult(a) ? kinds.includes('18+') : true) && kinds.includes(kindOf(a));
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!HOME_V2_EMAILS.includes(em)) { toast.error('This account is not allowed here.'); return; }
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    setLoggingIn(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Logged in');
    setShowLogin(false); setPassword('');
  };

  useEffect(() => {
    document.title = 'Watch';
    const load = () => {
    (async () => {
      // Series order = most recent episode upload first, then newest series.
      const [{ data: recentEps }, { data: newest }] = await Promise.all([
        supabase.from('episodes').select('created_at, season:season_id ( anime_id )')
          .order('created_at', { ascending: false }).limit(400),
        supabase.from('anime').select('id, title, cover_image, type, is_eng_dub, is_sub_only, genres')
          .order('created_at', { ascending: false }).limit(60),
      ]);
      const order: string[] = [];
      for (const e of (recentEps as any[]) || []) {
        const id = e.season?.anime_id;
        if (id && !order.includes(id)) order.push(id);
      }
      const known = new Map((newest || []).map((a) => [a.id, a]));
      const missing = order.filter((id) => !known.has(id));
      if (missing.length) {
        const { data: extra } = await supabase.from('anime')
          .select('id, title, cover_image, type, is_eng_dub, is_sub_only, genres').in('id', missing);
        (extra || []).forEach((a) => known.set(a.id, a));
      }
      const ordered = order.map((id) => known.get(id)).filter(Boolean) as AnimeHit[];
      (newest || []).forEach((a) => { if (!order.includes(a.id)) ordered.push(a); });
      setSeries(ordered);
    })();
    supabase
      .from('episodes')
      .select('id, episode_number, thumbnail, season:season_id ( season_number, anime:anime_id ( title, cover_image, type, is_eng_dub, is_sub_only, genres ) )')
      .order('created_at', { ascending: false })
      .limit(24)
      .then(({ data }) => setEpisodes(((data as any) || []).filter((e: Ep) => e.season?.anime)));
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('anime').select('id, title, cover_image, type, is_eng_dub, is_sub_only, genres').ilike('title', `%${q}%`).limit(8);
      setHits(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const openAnime = async (animeId: string) => {
    setBusy(true);
    const { data: seasons } = await supabase.from('seasons').select('id').eq('anime_id', animeId).order('season_number').limit(1);
    const seasonId = seasons?.[0]?.id;
    if (seasonId) {
      const { data: eps } = await supabase.from('episodes').select('id').eq('season_id', seasonId).order('episode_number').limit(1);
      if (eps?.[0]) { navigate(`/s2/${eps[0].id}?from=home-v2`); return; }
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-end gap-2">
          {allowed && (
            <div className="relative">
              <button onClick={() => setShowTypes((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold hover:text-primary">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Show type
              </button>
              {showTypes && (
                <div className="absolute right-0 z-30 mt-2 w-40 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
                  {ALL_KINDS.map((k) => (
                    <button key={k} onClick={() => toggleKind(k)}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-muted">
                      {k}
                      <span className={`grid h-4 w-4 place-items-center rounded border ${kinds.includes(k) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {kinds.includes(k) && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {user ? (
            <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold hover:text-primary">
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          ) : (
            <button onClick={() => setShowLogin(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold hover:text-primary">
              <LogIn className="h-3.5 w-3.5" /> Login
            </button>
          )}
        </div>
        {showLogin && !user && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowLogin(false)}>
            <form onSubmit={doLogin} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5 shadow-2xl">
              <h2 className="text-lg font-semibold">Login</h2>
              <p className="text-xs text-muted-foreground">Use your existing account.</p>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <button disabled={loggingIn} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {loggingIn ? 'Logging in…' : 'Login'}
              </button>
            </form>
          </div>
        )}
        <div className="relative mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 backdrop-blur-xl focus-within:border-primary/60">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          {hits.length > 0 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {hits.filter(visible).map((a) => (
                <button key={a.id} disabled={busy} onClick={() => openAnime(a.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted">
                  <img src={a.cover_image || '/placeholder.svg'} alt="" className="h-12 w-9 rounded object-cover" />
                  <span className="text-sm font-medium line-clamp-1">{a.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 mb-4 flex gap-2">
          {([['series', 'Latest Series'], ['movies', 'Latest Movies']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${tab === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-row">
          {series.filter(visible).filter((a) => (tab === 'movies' ? a.type === 'movie' : a.type !== 'movie')).slice(0, 30).map((a) => (
            <button key={a.id} disabled={busy} onClick={() => openAnime(a.id)} className="group w-[120px] md:w-[160px] shrink-0 text-left">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border group-hover:ring-primary/60 transition">
                <img src={a.cover_image || '/placeholder.svg'} alt={a.title} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute top-1.5 right-1.5"><DubBadge isEngDub={a.is_eng_dub} isSubOnly={a.is_sub_only} /></div>{isAdult(a) && <span className="absolute top-1.5 left-1.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">18+</span>}
              </div>
              <p className="mt-1.5 text-xs md:text-sm font-semibold line-clamp-2">{a.title}</p>
            </button>
          ))}
        </div>

        <h2 className="mt-12 mb-4 text-lg font-semibold">New Episodes</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-row">
          {episodes.filter((ep) => visible(ep.season?.anime)).map((ep) => (
            <button key={ep.id} onClick={() => navigate(`/s2/${ep.id}?from=home-v2`)}
              className="group w-[220px] md:w-[280px] shrink-0 text-left">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border group-hover:ring-primary/60 transition">
                <img src={ep.thumbnail || ep.season?.anime?.cover_image || '/placeholder.svg'} alt={ep.season?.anime?.title}
                  loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute top-1.5 right-1.5"><DubBadge isEngDub={ep.season?.anime?.is_eng_dub} isSubOnly={ep.season?.anime?.is_sub_only} /></div>{isAdult(ep.season?.anime) && <span className="absolute top-1.5 left-1.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">18+</span>}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="rounded-full bg-primary p-3"><Play className="h-5 w-5 fill-current text-primary-foreground" /></span>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold line-clamp-1">{ep.season?.anime?.title}</p>
              <p className="text-xs text-muted-foreground">S{ep.season?.season_number} · Episode {ep.episode_number}</p>
            </button>
          ))}
        </div>

        <div className="mt-16 text-center">
          <span className="group inline-block cursor-default text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Powered by{' '}
            <span className="font-bold text-foreground transition-colors duration-300 group-hover:text-primary">AnimeSavi</span>
          </span>
        </div>
      </div>
    </div>
  );
}
