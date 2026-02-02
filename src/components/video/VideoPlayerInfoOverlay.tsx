import { cn } from '@/lib/utils';

interface VideoPlayerInfoOverlayProps {
  animeTitle: string;
  episodeNumber: number;
  seasonNumber?: number;
  isVisible: boolean;
  className?: string;
}

export function VideoPlayerInfoOverlay({
  animeTitle,
  episodeNumber,
  seasonNumber = 1,
  isVisible,
  className,
}: VideoPlayerInfoOverlayProps) {
  if (!isVisible) return null;

  return (
    <>
      {/* Anime Title - Top Left */}
      <div 
        className={cn(
          "absolute top-4 left-4 z-[60] transition-opacity duration-300 pointer-events-none",
          isVisible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 max-w-[200px] sm:max-w-[300px]">
          <p className="text-white text-xs sm:text-sm font-medium truncate">
            {animeTitle}
          </p>
        </div>
      </div>

      {/* Season/Episode Info - Top Right */}
      <div 
        className={cn(
          "absolute top-4 right-4 z-[60] transition-opacity duration-300 pointer-events-none",
          isVisible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
          <p className="text-white text-xs sm:text-sm font-medium">
            S{seasonNumber} E{episodeNumber}
          </p>
        </div>
      </div>
    </>
  );
}
