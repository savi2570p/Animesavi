import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Play } from 'lucide-react';

interface Ep {
  id: string;
  episode_number: number;
  thumbnail: string | null;
  season: { season_number: number; anime: { title: string; cover_image: string | null; type: string | null } | null } | null;
}

interface AnimeHit { id: string; title: string; cover_image: string | null }

export default function ShadowHome() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Ep[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AnimeHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<AnimeHit[]>([]);

  useEffect(() => {
    document.title = 'Watch';
    const load = () => {
    supabase.from('anime').select('id, title, cover_image').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setSeries(data || []));
    supabase
      .from('episodes')
      .select('id, episode_number, thumbnail, season:season_id ( season_number, anime:anime_id ( title, cover_image, type ) )')
      .order('created_at', { ascending: false })
      .limit(24)
      .then(({ data }) => setEpisodes(((data as any) || []).filter((e: Ep) => e.season?.anime)));
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 120000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('anime').select('id, title, cover_image').ilike('title', `%${q}%`).limit(8);
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
      if (eps?.[0]) { navigate(`/s2/${eps[0].id}`); return; }
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
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
              {hits.map((a) => (
                <button key={a.id} disabled={busy} onClick={() => openAnime(a.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted">
                  <img src={a.cover_image || '/placeholder.svg'} alt="" className="h-12 w-9 rounded object-cover" />
                  <span className="text-sm font-medium line-clamp-1">{a.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <h2 className="mt-12 mb-4 text-lg font-semibold">Latest Series</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-4">
          {series.map((a) => (
            <button key={a.id} disabled={busy} onClick={() => openAnime(a.id)} className="group text-left">
              <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border group-hover:ring-primary/60 transition">
                <img src={a.cover_image || '/placeholder.svg'} alt={a.title} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-1.5 text-xs md:text-sm font-semibold line-clamp-2">{a.title}</p>
            </button>
          ))}
        </div>

        <h2 className="mt-12 mb-4 text-lg font-semibold">New Episodes</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-row">
          {episodes.map((ep) => (
            <button key={ep.id} onClick={() => navigate(`/s2/${ep.id}`)}
              className="group w-[220px] md:w-[280px] shrink-0 text-left">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-border group-hover:ring-primary/60 transition">
                <img src={ep.thumbnail || ep.season?.anime?.cover_image || '/placeholder.svg'} alt={ep.season?.anime?.title}
                  loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
