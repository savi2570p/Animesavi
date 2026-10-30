import { ResumeArtwork } from '@/components/anime/ResumeArtwork';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clock, ArrowLeft, Filter, Trash2, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  id: string;
  watched_at: string;
  progress: number | null;
  completed: boolean | null;
  last_position: number | null;
  duration: number | null;
  anime: { id: string; title: string; cover_image: string | null; banner_image: string | null } | null;
  episode: { id: string; title: string; episode_number: number; duration: number | null; season_id: string; thumbnail: string | null } | null;
}

type Tab = 'all' | 'in-progress' | 'completed';

export default function ContinueWatchingAll() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('in-progress');

  useEffect(() => {
    if (!user) { nav('/auth'); return; }
    (async () => {
      const { data } = await supabase
        .from('watch_history')
        .select('id,watched_at,progress,completed,last_position,duration,anime:anime_id(id,title,cover_image,banner_image),episode:episode_id(id,title,episode_number,duration,season_id,thumbnail)')
        .eq('user_id', user.id)
        .order('watched_at', { ascending: false })
        .limit(200);
      setRows((data as unknown as Row[]) || []);
      setLoading(false);
    })();
  }, [user, nav]);

  const remove = async (id: string) => {
    await supabase.from('watch_history').delete().eq('id', id);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success('Removed');
  };

  const filtered = rows.filter((r) => {
    if (tab === 'completed') return r.completed;
    if (tab === 'in-progress') return !r.completed && (r.progress || 0) > 0 && (r.progress || 0) < 100;
    return true;
  });

  const stats = {
    total: rows.length,
    watching: rows.filter((r) => !r.completed && (r.progress || 0) > 0 && (r.progress || 0) < 100).length,
    done: rows.filter((r) => r.completed).length,
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic hero */}
      <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/15 via-background to-background">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-anime-pink/15 blur-3xl pointer-events-none" />
        <div className="container relative py-8 md:py-12">
          <Button variant="ghost" size="sm" onClick={() => nav('/')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Home
          </Button>
          <div className="flex items-center gap-2 text-xs text-primary/80 mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Your journey
          </div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3">
            Continue <span className="text-primary">Watching</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mb-6">
            Pick up where you left off. Every episode you've started, cleanly organized.
          </p>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2 md:gap-3">
            {[
              { label: 'Total', value: stats.total },
              { label: 'In progress', value: stats.watching },
              { label: 'Completed', value: stats.done },
            ].map((s) => (
              <div key={s.label} className="px-4 py-2 rounded-full bg-card/60 backdrop-blur border border-border/40 text-xs md:text-sm">
                <span className="text-muted-foreground">{s.label}: </span>
                <span className="font-semibold text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container py-6">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {(['in-progress', 'completed', 'all'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs md:text-sm rounded-full whitespace-nowrap transition-all border ${
                tab === t
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
                  : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
              }`}
            >
              {t === 'in-progress' ? 'In Progress' : t === 'completed' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="h-14 w-14 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Nothing to show here yet.</p>
            <Button asChild className="mt-4"><Link to="/browse">Discover anime</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => {
              if (!r.anime || !r.episode) return null;
              const pct = Math.min(100, Math.max(0, r.progress || 0));
              return (
                <div key={r.id} className="group relative">
                  <Link
                    to={`/watch/${r.episode.id}?t=${pct}`}
                    className="resume-original-art block relative aspect-video rounded-2xl overflow-hidden border border-border/40 bg-background shadow-md group-hover:shadow-2xl group-hover:shadow-primary/25 group-hover:border-primary/60 transition-all duration-500"
                  >
                    <ResumeArtwork sources={[r.episode.thumbnail, r.anime.banner_image, r.anime.cover_image]} alt={r.anime.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="h-14 w-14 rounded-full bg-primary/90 grid place-items-center backdrop-blur shadow-lg shadow-primary/50">
                        <Play className="h-6 w-6 text-primary-foreground fill-current translate-x-0.5" />
                      </div>
                    </div>
                    {r.completed && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-semibold">
                        <Check className="h-3 w-3" /> Done
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-[10px] text-white/70 uppercase tracking-wider mb-0.5">Episode {r.episode.episode_number}</p>
                      <h3 className="text-sm font-semibold text-white line-clamp-1">{r.anime.title}</h3>
                      <div className="mt-2">
                        <Progress value={pct} className="h-1 bg-white/20" />
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => remove(r.id)}
                    aria-label="Remove"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white/80 hover:bg-destructive hover:text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
