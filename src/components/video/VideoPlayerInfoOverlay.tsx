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
          "absolute top-2 sm:top-4 left-2 sm:left-4 z-[60] transition-opacity duration-300 pointer-events-none",
          // Leave room for the S/E chip on the right (~5rem on mobile, ~6rem on desktop)
          "right-[5.5rem] sm:right-[7rem]",
          isVisible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        <div className="inline-block max-w-full bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2">
          <p className="text-white text-[11px] sm:text-sm font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis">
            {animeTitle}
          </p>
        </div>
      </div>

      {/* Season/Episode Info - Top Right */}
      <div
        className={cn(
          "absolute top-2 sm:top-4 right-2 sm:right-4 z-[60] transition-opacity duration-300 pointer-events-none",
          isVisible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2">
          <p className="text-white text-[11px] sm:text-sm font-medium whitespace-nowrap">
            S{seasonNumber} E{episodeNumber}
          </p>
        </div>
      </div>
    </>
  );
}
