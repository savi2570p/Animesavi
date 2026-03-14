import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface EncodingOverlayProps {
  isVisible: boolean;
  episodeId: string;
  onComplete: () => void;
}

const ENCODING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getStorageKey(episodeId: string) {
  return `encoding_start_${episodeId}`;
}

export function EncodingOverlay({ isVisible, episodeId, onComplete }: EncodingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(ENCODING_DURATION_MS / 1000);
  const [showPopup, setShowPopup] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();

  const getStartTime = useCallback(() => {
    const key = getStorageKey(episodeId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return parseInt(stored, 10);
    }
    // First visit — persist the start time
    const now = Date.now();
    localStorage.setItem(key, now.toString());
    return now;
  }, [episodeId]);

  useEffect(() => {
    if (!isVisible) return;

    // Show popup immediately when encoding is detected
    setShowPopup(true);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || showPopup) return;

    const startTime = getStartTime();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / ENCODING_DURATION_MS) * 100, 100);
      setProgress(pct);
      setRemaining(Math.max(0, Math.ceil((ENCODING_DURATION_MS - elapsed) / 1000)));

      if (pct >= 100) {
        clearInterval(intervalRef.current);
        localStorage.removeItem(getStorageKey(episodeId));
        onComplete();
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible, episodeId, onComplete, getStartTime, showPopup]);

  if (!isVisible) return null;

  // Show popup first
  if (showPopup) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-6 md:p-8 max-w-sm mx-4 shadow-2xl text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h3 className="text-foreground font-bold text-xl">Video Encoding</h3>
          <p className="text-muted-foreground text-sm">
            This video is currently being encoded and is not yet available for playback. Please check back later.
          </p>
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => navigate('/')}
          >
            OK
          </Button>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
      <h3
        className="text-xl md:text-2xl font-bold text-white mb-2"
        style={{ textShadow: '0 0 12px hsla(var(--primary) / 0.5)' }}
      >
        The video is on encoding stage
      </h3>
      <p className="text-sm text-white/60 mb-6">
        Please wait — ready in {minutes}:{seconds.toString().padStart(2, '0')}
      </p>
      <div className="w-64 md:w-80">
        <Progress value={progress} className="h-3 bg-white/10" />
        <p className="text-center text-primary font-mono font-bold text-lg mt-3">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}
