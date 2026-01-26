import { Volume2, Sun, ZoomIn } from 'lucide-react';

interface GestureIndicatorProps {
  type: 'volume' | 'brightness' | 'zoom' | null;
  value: number;
  isVisible: boolean;
  position: 'left' | 'right' | 'center';
}

export function GestureIndicator({ type, value, isVisible, position }: GestureIndicatorProps) {
  if (!isVisible || !type) return null;

  const getIcon = () => {
    switch (type) {
      case 'volume':
        return <Volume2 className="w-6 h-6 text-white" />;
      case 'brightness':
        return <Sun className="w-6 h-6 text-white" />;
      case 'zoom':
        return <ZoomIn className="w-6 h-6 text-white" />;
      default:
        return null;
    }
  };

  const getDisplayValue = () => {
    switch (type) {
      case 'volume':
        return `${Math.round(value * 100)}%`;
      case 'brightness':
        return `${Math.round(value * 100)}%`;
      case 'zoom':
        return `${value.toFixed(1)}x`;
      default:
        return '';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'volume':
        return 'Volume';
      case 'brightness':
        return 'Brightness';
      case 'zoom':
        return 'Zoom';
      default:
        return '';
    }
  };

  const getProgressValue = () => {
    switch (type) {
      case 'volume':
        return value * 100;
      case 'brightness':
        // Normalize brightness from 0.2-1.5 range to 0-100
        return ((value - 0.2) / 1.3) * 100;
      case 'zoom':
        // Normalize zoom from 1-3 range to 0-100
        return ((value - 1) / 2) * 100;
      default:
        return 0;
    }
  };

  const positionClasses = {
    left: 'left-8',
    right: 'right-8',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div 
      className={`absolute top-1/2 -translate-y-1/2 ${positionClasses[position]} z-[100] pointer-events-none animate-fade-in`}
    >
      <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 flex flex-col items-center gap-3 min-w-[80px] shadow-2xl border border-white/10">
        {/* Icon */}
        <div className="p-2 rounded-full bg-white/10">
          {getIcon()}
        </div>

        {/* Vertical progress bar */}
        <div className="relative h-28 w-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="absolute bottom-0 left-0 right-0 bg-primary rounded-full transition-all duration-100"
            style={{ height: `${Math.max(0, Math.min(100, getProgressValue()))}%` }}
          />
        </div>

        {/* Value */}
        <div className="text-center">
          <p className="text-white font-bold text-lg">{getDisplayValue()}</p>
          <p className="text-white/60 text-xs">{getLabel()}</p>
        </div>
      </div>
    </div>
  );
}
