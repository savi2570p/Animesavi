import { useEffect, useRef, useState } from 'react';
import { Sparkles, Play, Pause, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useRecapAnalytics } from '@/hooks/useRecapAnalytics';

interface RecapSidebarProps {
  episodeId: string;
  partyId?: string | null;
  isHost?: boolean;
  /** Approx duration the recap should "play" for analytics + sync. */
  approxDurationSec?: number;
}

/**
 * AI recap panel for the watch party. Loads the recap text, lets the host
 * start a synced "play" countdown so everyone in the room sees the same
 * elapsed timer, and tracks open + completion analytics.
 */
export function RecapSidebar({
  episodeId,
  partyId,
  isHost = false,
  approxDurationSec = 30,
}: RecapSidebarProps) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { trackOpen, trackComplete, trackProgress } = useRecapAnalytics({
    episodeId,
    watchPartyId: partyId ?? null,
    context: partyId ? 'watch_party' : 'episode',
  });

  const opened = useRef(false);

  // Fetch recap text (and trigger generation if missing)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('episodes')
        .select('ai_recap')
        .eq('id', episodeId)
        .maybeSingle();
      if (cancelled) return;

      if (data?.ai_recap) {
        setRecap(data.ai_recap);
        setLoading(false);
        if (!opened.current) {
          opened.current = true;
          trackOpen();
        }
        return;
      }

      // Lazy-generate when missing
      setGenerating(true);
      try {
        const { data: gen } = await supabase.functions.invoke('generate-episode-recap', {
          body: { episode_id: episodeId },
        });
        if (!cancelled && gen?.recap) {
          setRecap(gen.recap);
          if (!opened.current) {
            opened.current = true;
            trackOpen();
          }
        }
      } catch { /* ignore */ }
      setGenerating(false);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [episodeId, trackOpen]);

  // Subscribe to party recap state for auto-sync across the room
  useEffect(() => {
    if (!partyId) return;
    const channel = supabase
      .channel(`recap-sync-${partyId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'watch_parties', filter: `id=eq.${partyId}`,
        // deno-lint-ignore no-explicit-any
      }, (payload: any) => {
        const next = payload.new ?? {};
        if (next.recap_started_at) {
          setStartedAt(new Date(next.recap_started_at).getTime());
          setIsPlaying(!!next.recap_is_playing);
        } else {
          setStartedAt(null); setIsPlaying(false);
        }
      })
      .subscribe();

    // Initial pull
    supabase
      .from('watch_parties')
      .select('recap_started_at, recap_is_playing')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.recap_started_at) return;
        setStartedAt(new Date(data.recap_started_at).getTime());
        setIsPlaying(!!data.recap_is_playing);
      });

    return () => { supabase.removeChannel(channel); };
  }, [partyId]);

  // Local elapsed ticker (uses synced startedAt for everyone)
  useEffect(() => {
    if (!isPlaying || !startedAt) return;
    const id = window.setInterval(() => {
      const e = Math.min(approxDurationSec, (Date.now() - startedAt) / 1000);
      setElapsed(e);
      trackProgress(e);
      if (e >= approxDurationSec) {
        trackComplete();
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [isPlaying, startedAt, approxDurationSec, trackComplete, trackProgress]);

  const start = async () => {
    if (!partyId) {
      // Solo mode — just run the local timer
      setStartedAt(Date.now()); setIsPlaying(true); setElapsed(0);
      return;
    }
    if (!isHost) return;
    await supabase.from('watch_parties')
      .update({ recap_started_at: new Date().toISOString(), recap_is_playing: true, recap_position_seconds: 0 })
      .eq('id', partyId);
  };

  const pause = async () => {
    if (!partyId) { setIsPlaying(false); return; }
    if (!isHost) return;
    await supabase.from('watch_parties')
      .update({ recap_is_playing: false })
      .eq('id', partyId);
  };

  const pct = Math.min(100, (elapsed / approxDurationSec) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Episode Recap
          <span className="ml-auto text-[10px] uppercase tracking-wider text-primary/80 bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded-full">
            ~30s
          </span>
        </div>
        {partyId && (
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Users className="h-3 w-3" /> Synced with everyone in the room
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
        {loading || generating ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {generating ? 'Generating recap with AI…' : 'Loading recap…'}
          </div>
        ) : recap ? (
          <p className="whitespace-pre-wrap text-foreground/90">{recap}</p>
        ) : (
          <p className="text-muted-foreground">No recap available yet.</p>
        )}
      </div>

      {recap && (
        <div className="border-t border-border/40 p-3 space-y-2 bg-card/40">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.floor(elapsed)}s / {approxDurationSec}s
            </span>
            {isPlaying ? (
              <Button size="sm" variant="outline" onClick={pause} disabled={!!partyId && !isHost}>
                <Pause className="h-3.5 w-3.5 mr-1" /> Pause
              </Button>
            ) : (
              <Button size="sm" onClick={start} disabled={!!partyId && !isHost}>
                <Play className="h-3.5 w-3.5 mr-1" />
                {partyId ? (isHost ? 'Play for room' : 'Host controls playback') : 'Play recap'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
