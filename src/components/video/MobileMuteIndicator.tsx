import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileMuteIndicatorProps {
  isMuted: boolean;
  isVisible: boolean;
  onTap: () => void;
}

/**
 * Mobile Mute Indicator
 * Shows a floating indicator when video is muted due to autoplay policy
 * Prompts users to tap to enable sound
 */
export function MobileMuteIndicator({ isMuted, isVisible, onTap }: MobileMuteIndicatorProps) {
  if (!isVisible || !isMuted) return null;

  return (
    <div 
      className={cn(
        "absolute top-4 right-4 z-50",
        "animate-fade-in"
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTap();
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-black/70 backdrop-blur-sm border border-white/20",
          "text-white text-sm font-medium",
          "transition-all duration-300 hover:bg-black/80 hover:scale-105",
          "active:scale-95"
        )}
        aria-label="Tap to unmute"
      >
        <div className="relative">
          <VolumeX className="w-4 h-4" />
          {/* Pulsing dot indicator */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
        <span className="text-xs">Tap to unmute</span>
      </button>
    </div>
  );
}
