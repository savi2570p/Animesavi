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
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-fade-in">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Play className="h-8 w-8 text-primary" />
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
              variant="outline"
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
