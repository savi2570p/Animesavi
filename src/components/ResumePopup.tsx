import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';

interface ResumePopupProps {
  progress: number;
  duration: number;
  onResume: () => void;
  onStartOver: () => void;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ResumePopup({ progress, duration, onResume, onStartOver }: ResumePopupProps) {
  const savedTimeSeconds = (progress / 100) * duration;
  const timeDisplay = duration > 0 ? formatTime(savedTimeSeconds) : `${progress}%`;

  return (
    <div className="utility-overlay-v6 absolute inset-0 z-30 flex items-center justify-center">
      <div className="resume-player-v8 utility-glass-v6 p-3 max-w-[260px] w-full mx-3 motion-safe:animate-fade-in">
        <div className="text-center space-y-2">
          
          <div>
            <h3 className="text-sm font-semibold mb-1">Continue Watching?</h3>
            <p className="text-muted-foreground text-xs">
              You left off at <span className="text-primary font-medium">{timeDisplay}</span>
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="glass"
              size="sm"
              className="flex-1 px-2 text-xs"
              onClick={onStartOver}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button
              size="sm"
              className="flex-1 px-2 text-xs"
              onClick={onResume}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
