import { useState, useEffect, useRef, useCallback } from 'react';
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

export function EncodingOverlay({ isVisible, episodeId, onComplete }: EncodingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('queued');
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();

  // Poll the real video_conversions table for progress
  useEffect(() => {
    if (!isVisible) return;

    const poll = async () => {
      const { data } = await supabase
        .from('video_conversions')
        .select('status, conversion_progress, conversion_stage, estimated_seconds_remaining')
        .eq('episode_id', episodeId)
        .maybeSingle();

      if (!data) return;

      if (data.status === 'completed') {
        setProgress(100);
        setStage('completed');
        // Auto-play after short delay
        setTimeout(() => onComplete(), 1500);
        return;
      }

      setProgress(data.conversion_progress ?? 0);
      setStage(data.conversion_stage ?? data.status ?? 'queued');
      setRemaining(data.estimated_seconds_remaining);
    };

    poll();
    intervalRef.current = setInterval(poll, 5000); // poll every 5s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible, episodeId, onComplete]);

  if (!isVisible) return null;

  const stageLabel = stage === 'queued' ? 'Queued' 
    : stage === 'analyzing' ? 'Analyzing' 
    : stage === 'converting' ? 'Converting'
    : stage === 'uploading' ? 'Uploading'
    : stage === 'completed' ? 'Complete'
    : stage === 'failed' ? 'Failed'
    : 'Processing';

  const remainingText = remaining && remaining > 0
    ? `~${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')} remaining`
    : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-6 md:p-8 max-w-sm mx-4 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h3 className="text-foreground font-bold text-xl">Video Encoding</h3>
        <p className="text-muted-foreground text-sm">
          This episode is being encoded for playback. It will start automatically when ready.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stageLabel}</span>
            <span className="font-mono font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-white/10" />
          {remainingText && (
            <p className="text-xs text-muted-foreground">{remainingText}</p>
          )}
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
