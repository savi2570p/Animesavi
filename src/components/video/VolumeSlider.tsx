import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  isVertical?: boolean;
  size?: 'sm' | 'md';
}

export function VolumeSlider({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  isVertical = false,
  size = 'md',
}: VolumeSliderProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const buttonSize = size === 'sm' ? 'w-8 h-8' : 'w-8 h-8 md:w-10 md:h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-4 h-4 md:w-5 md:h-5';

  const effectiveVolume = isMuted ? 0 : volume;

  const VolumeIcon = effectiveVolume === 0 
    ? VolumeX 
    : effectiveVolume < 0.5 
      ? Volume1 
      : Volume2;

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setIsHovering(true);
    setShowSlider(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    hideTimeoutRef.current = setTimeout(() => {
      setShowSlider(false);
    }, 300);
  };

  const handleSliderChange = (value: number[]) => {
    onVolumeChange(value[0] / 100);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative flex items-center ${isVertical ? 'flex-col-reverse' : 'flex-row'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Volume button */}
      <button
        className={`${buttonSize} rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors`}
        onClick={(e) => {
          e.stopPropagation();
          onMuteToggle();
        }}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className={iconSize} />
      </button>

      {/* Slider popup */}
      {showSlider && (
        <div 
          className={`
            absolute bg-black/90 backdrop-blur-md rounded-lg p-3 shadow-xl border border-white/10
            animate-fade-in transition-all duration-200
            ${isVertical 
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' 
              : 'left-full top-1/2 -translate-y-1/2 ml-2'
            }
          `}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isVertical ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-white text-xs font-mono">
                {Math.round(effectiveVolume * 100)}%
              </span>
              <div className="h-24 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={effectiveVolume * 100}
                  onChange={(e) => onVolumeChange(parseInt(e.target.value) / 100)}
                  className="h-24 w-2 appearance-none bg-white/20 rounded-full cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg
                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary 
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    background: `linear-gradient(to top, hsl(var(--primary)) ${effectiveVolume * 100}%, rgba(255,255,255,0.2) ${effectiveVolume * 100}%)`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-24">
                <Slider
                  value={[effectiveVolume * 100]}
                  onValueChange={handleSliderChange}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
              <span className="text-white text-xs font-mono min-w-[32px]">
                {Math.round(effectiveVolume * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
