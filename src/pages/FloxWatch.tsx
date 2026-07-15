import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
  episode_number: number | null;
  season_number: number | null;
}

type Server = 'flox' | 'anime-plus';

export default function FloxWatch() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [ep, setEp] = useState<FloxRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [server, setServer] = useState<Server>('flox');

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

  return (
    <AntiPiracyShield mode="strict" noRedirect>
      <div className="container py-4 space-y-4 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Back</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !ep ? (
          <p className="text-sm text-muted-foreground">Episode not found.</p>
        ) : (
          <div className="space-y-4">
            {/* Server switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Server:</span>
              {([
                { id: 'flox', label: 'Flox +' },
                { id: 'anime-plus', label: 'Anime+' },
              ] as { id: Server; label: string }[]).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServer(s.id)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${
                    server === s.id
                      ? 'bg-primary text-primary-foreground border-primary shadow shadow-primary/30'
                      : 'bg-card/40 text-muted-foreground border-border/40 hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <FloxPlayer
              key={server}
              sourceType={ep.source_type}
              sourceUrl={ep.source_url}
              poster={ep.poster_url || ep.banner_url || undefined}
              title={ep.title}
            />
            <div className="flex items-start gap-4">
              {ep.poster_url && (
                <img
                  src={ep.poster_url}
                  alt={ep.title}
                  draggable={false}
                  className="w-20 md:w-28 aspect-[2/3] object-cover rounded-md shadow-lg ring-1 ring-border/40"
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
              <div className="flex-1 space-y-1">
                <h1 className="text-xl md:text-2xl font-bold">{ep.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Season {ep.season_number ?? 1} · Episode {ep.episode_number ?? '—'}
                </p>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  {server === 'anime-plus' ? 'Anime+ server' : 'Flox + server'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AntiPiracyShield>
  );
}
