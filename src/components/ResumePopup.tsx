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
      <div className="resume-player-v8 utility-glass-v6 p-5 max-w-sm w-full mx-4 motion-safe:animate-fade-in">
        <div className="text-center space-y-4">
          <div className="utility-icon-v6 w-11 h-11 mx-auto rounded-lg flex items-center justify-center">
            <Play className="h-5 w-5 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-1">Continue Watching?</h3>
            <p className="text-muted-foreground text-sm">
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

          <div className="flex gap-3 pt-2">
            <Button
              variant="glass"
              className="flex-1"
              onClick={onStartOver}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
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
