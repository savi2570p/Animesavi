import { cn } from '@/lib/utils';

interface PremiumLoaderProps {
  isVisible: boolean;
  className?: string;
}

/**
 * Premium Netflix-style loading animation for the video player.
 * Features a minimal circular spinner with subtle glow effect.
 */
export function PremiumLoader({ isVisible, className }: PremiumLoaderProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
    >
      {/* Premium Spinner */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full blur-xl bg-white/10 animate-pulse" />
        
        {/* Main spinner */}
        <div className="relative w-16 h-16">
          <svg
            className="w-full h-full animate-spin"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ animationDuration: '1s' }}
          >
            {/* Background circle */}
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="3"
              fill="none"
            />
            {/* Animated arc */}
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="url(#spinnerGradient)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="120 176"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.4))' }}
            />
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.3)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
