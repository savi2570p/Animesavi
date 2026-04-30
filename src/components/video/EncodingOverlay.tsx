import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface EncodingOverlayProps {
  isVisible: boolean;
  episodeId: string;
  onComplete: () => void;
}

// Total wait window for a freshly uploaded episode: 5 minutes.
const TOTAL_WAIT_MS = 5 * 60 * 1000;

export function EncodingOverlay({ isVisible, episodeId, onComplete }: EncodingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [remainingMs, setRemainingMs] = useState(TOTAL_WAIT_MS);
  const tickRef = useRef<NodeJS.Timeout>();
  const pollRef = useRef<NodeJS.Timeout>();
  const startedAtRef = useRef<number>(Date.now());
  const navigate = useNavigate();

  // Per-episode persisted start time so the 5-minute window doesn't restart
  // when the user navigates away and comes back to the same fresh episode.
  useEffect(() => {
    if (!isVisible) return;
    const key = `encoding_start_${episodeId}`;
    const stored = Number(localStorage.getItem(key));
    if (stored && !Number.isNaN(stored)) {
      startedAtRef.current = stored;
    } else {
      startedAtRef.current = Date.now();
      localStorage.setItem(key, String(startedAtRef.current));
    }
  }, [isVisible, episodeId]);

  // Time-based progress (5 minutes guaranteed)
  useEffect(() => {
    if (!isVisible) return;

    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const pct = Math.min(100, (elapsed / TOTAL_WAIT_MS) * 100);
      setProgress(pct);
      setRemainingMs(Math.max(0, TOTAL_WAIT_MS - elapsed));
      if (elapsed >= TOTAL_WAIT_MS) {
        if (tickRef.current) clearInterval(tickRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
        // 5 minutes done — release the player
        setTimeout(() => onComplete(), 400);
      }
    };

    tick();
    tickRef.current = setInterval(tick, 250);

    // Also poll the conversion record. If it completes early, also release.
    const poll = async () => {
      const { data } = await supabase
        .from('video_conversions')
        .select('status')
        .eq('episode_id', episodeId)
        .maybeSingle();
      if (data?.status === 'completed') {
        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed >= TOTAL_WAIT_MS) {
          if (tickRef.current) clearInterval(tickRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
          onComplete();
        }
      }
    };
    pollRef.current = setInterval(poll, 10000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isVisible, episodeId, onComplete]);

  if (!isVisible) return null;

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const remainingText = `~${mm}:${ss.toString().padStart(2, '0')} remaining`;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-6 md:p-8 max-w-sm mx-4 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h3 className="text-foreground font-bold text-xl">Processing in 4K</h3>
        <p className="text-muted-foreground text-sm">
          The video file is processing in 4K, please come back later.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Encoding</span>
            <span className="font-mono font-bold text-primary">{Math.floor(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-white/10" />
          <p className="text-xs text-muted-foreground">{remainingText}</p>
        </div>

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => navigate('/')}
        >
          Go Home
        </Button>
      </div>
    </div>
  );
}
