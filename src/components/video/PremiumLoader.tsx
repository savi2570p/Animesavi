import { cn } from '@/lib/utils';
import { PlayerSpinner } from './PlayerSpinner';

interface PremiumLoaderProps {
  isVisible: boolean;
  className?: string;
}

/**
 * Transparent initial player loader: no scrim or panel, just the shared
 * slim spinner floating over whatever frame is beneath it.
 */
export function PremiumLoader({ isVisible, className }: PremiumLoaderProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-300 pointer-events-none',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      aria-hidden={!isVisible}
    >
      <PlayerSpinner />
    </div>
  );
}
