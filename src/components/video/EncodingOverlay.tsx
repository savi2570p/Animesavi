import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface EncodingOverlayProps {
  isVisible: boolean;
  onComplete: () => void;
}

const ENCODING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function EncodingOverlay({ isVisible, onComplete }: EncodingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isVisible) return;

    startTimeRef.current = Date.now();
    setProgress(0);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / ENCODING_DURATION_MS) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(intervalRef.current);
        onComplete();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const remaining = Math.max(0, Math.ceil((ENCODING_DURATION_MS - (Date.now() - startTimeRef.current)) / 1000));
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
