import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Server as ServerIcon } from 'lucide-react';
import { FloxPlayer } from '@/components/video/FloxPlayer';
import { AntiPiracyShield } from '@/components/security/AntiPiracyShield';
import { toast } from 'sonner';

interface FloxRow {
  id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  source_type: 'embed' | 'file';
  source_url: string;
  flox_source_url: string | null;
  anime_plus_source_url: string | null;
  anime_plus_source_type: string | null;
  episode_number: number | null;
  season_number: number | null;
}

type Server = 'flox' | 'anime-plus';

export default function FloxWatch() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [ep, setEp] = useState<FloxRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState<Server>('anime-plus');

  useEffect(() => {
    (async () => {
      if (!episodeId) return;
      const { data, error } = await supabase
        .from('flox_content')
        .select('*')
        .eq('id', episodeId)
        .maybeSingle();
      if (error) toast.error(error.message);
      setEp((data as FloxRow) || null);
      setLoading(false);
    })();
  }, [episodeId]);

  const servers: { id: Server; label: string }[] = [
    { id: 'anime-plus', label: 'Anime+' },
    { id: 'flox', label: 'Flox +' },
  ];

  /** Resolve the playable source for the selected server, with a safe
   *  fallback to the legacy single-source columns. */
  const active = useMemo(() => {
    if (!ep) return null;
    if (server === 'flox') {
      const url = ep.flox_source_url || (ep.source_type === 'embed' ? ep.source_url : '');
      return url ? { url, type: 'embed' as const } : null;
    }
    const url = ep.anime_plus_source_url || ep.source_url;
    const type = (ep.anime_plus_source_url
      ? (ep.anime_plus_source_type as 'embed' | 'file') || 'file'
      : ep.source_type) as 'embed' | 'file';
    return url ? { url, type } : null;
  }, [ep, server]);

  // If the default server has no source, switch to the one that does.
  useEffect(() => {
    if (!ep || active) return;
    setServer((s) => (s === 'anime-plus' ? 'flox' : 'anime-plus'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep]);


  return (
    <AntiPiracyShield mode="strict" noRedirect>
      <div className="relative min-h-screen overflow-hidden">
        <div className="flox-aurora" aria-hidden />
        {/* Poster blurred behind for cinematic ambience */}
        {ep?.poster_url && (
          <img
            src={ep.poster_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-3xl scale-125 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background pointer-events-none" />

        <div className="relative z-10 container py-4 md:py-6 space-y-5 select-none">
          {/* Glass back bar */}
          <div className="flox-glass rounded-2xl px-3 py-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full hover:bg-white/10 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-white/70">Back</span>
            {ep && (
              <span className="ml-auto text-[11px] text-white/60 truncate max-w-[60%]">
                {ep.title} · S{ep.season_number ?? 1} E{ep.episode_number ?? '—'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flox-glass rounded-3xl aspect-video grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          ) : !ep ? (
            <div className="flox-glass rounded-3xl p-10 text-center text-white/70">
              <p className="text-sm">Episode not found.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <FloxPlayer
                key={server}
                sourceType={ep.source_type}
                sourceUrl={ep.source_url}
                poster={ep.poster_url || ep.banner_url || undefined}
                title={ep.title}
              />

              {/* Server switcher — liquid glass chips */}
              <div className="flox-glass rounded-2xl p-3 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/60">
                  <ServerIcon className="h-3.5 w-3.5" />
                  Server
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {servers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (s.id === 'flox') {
                          setShowFloxRemoved(true);
                          return;
                        }
                        setServer(s.id);
                      }}
                      data-active={server === s.id}
                      className="flox-glass-chip px-3.5 py-1.5 rounded-full text-xs font-medium text-white/80 transition-all data-[active=true]:text-white"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episode info — glass panel */}
              <div className="flox-glass rounded-3xl p-4 md:p-5 flex items-start gap-4">
                {ep.poster_url && (
                  <img
                    src={ep.poster_url}
                    alt={ep.title}
                    draggable={false}
                    className="w-20 md:w-28 aspect-[2/3] object-cover rounded-2xl shadow-xl ring-1 ring-white/15 shrink-0"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{ep.title}</h1>
                  <p className="text-sm text-white/70">
                    Season {ep.season_number ?? 1} · Episode {ep.episode_number ?? '—'}
                  </p>
                  <span className="inline-flex flox-glass-chip px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest text-white/80">
                    {server === 'anime-plus' ? 'Anime+ server' : 'Flox + server'}
                  </span>
                  {ep.description && (
                    <p className="text-xs md:text-sm text-white/60 leading-relaxed line-clamp-3 pt-1">
                      {ep.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <AlertDialog open={showFloxRemoved} onOpenChange={setShowFloxRemoved}>
          <AlertDialogContent className="bg-black/80 backdrop-blur-2xl border-white/10 max-w-xs rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white text-base">Server Removed</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70 text-xs">
                This server is removed because it contain ads.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                className="bg-primary hover:bg-primary/90 text-white text-xs px-4 py-2 rounded-full"
                onClick={() => setShowFloxRemoved(false)}
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AntiPiracyShield>
  );
}
