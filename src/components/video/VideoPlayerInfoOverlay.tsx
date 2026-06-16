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
      {/* Season/Episode Info - Top Right (glassy) */}
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
