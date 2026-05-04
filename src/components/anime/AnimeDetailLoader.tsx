import { useEffect, useState } from 'react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Skeleton-style placeholder that mirrors the AnimeDetail layout —
 * blurred backdrop, hero/poster blocks, action buttons, episode rail.
 * Uses the brand shimmer (animate-pulse) over muted blocks.
 */
export function AnimeDetailLoader({ isReady, backdrop }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => setHidden(true), 280);
    return () => clearTimeout(t);
  }, [isReady]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden bg-background transition-opacity duration-300 ${
        isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-busy="true"
    >
      {/* Hero backdrop */}
      <div className="relative h-[58vh] min-h-[360px] w-full overflow-hidden">
        {backdrop ? (
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-40 animate-pulse"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-muted/40 animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />

        {/* Hero content skeleton */}
        <div className="relative z-10 h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-end pb-10">
          <div className="flex gap-5 w-full">
            {/* Poster */}
            <div className="hidden sm:block h-56 w-40 rounded-xl bg-muted/60 animate-pulse shrink-0 ring-1 ring-border/40" />

            <div className="flex-1 space-y-3">
              <div className="h-3 w-24 rounded-full bg-muted/60 animate-pulse" />
              <div className="h-8 sm:h-10 w-3/4 rounded-lg bg-muted/70 animate-pulse" />
              <div className="h-4 w-1/2 rounded-md bg-muted/50 animate-pulse" />
              <div className="flex gap-2 pt-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-6 w-16 rounded-full bg-muted/50 animate-pulse" />
                ))}
              </div>
              <div className="flex gap-3 pt-3">
                <div className="h-10 w-32 rounded-md bg-primary/40 animate-pulse" />
                <div className="h-10 w-10 rounded-md bg-muted/50 animate-pulse" />
                <div className="h-10 w-10 rounded-md bg-muted/50 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Synopsis lines */}
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-muted/50 animate-pulse" />
          <div className="h-3 w-11/12 rounded-full bg-muted/50 animate-pulse" />
          <div className="h-3 w-9/12 rounded-full bg-muted/50 animate-pulse" />
        </div>

        {/* Episodes header */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-5 w-32 rounded-md bg-muted/60 animate-pulse" />
          <div className="h-8 w-24 rounded-md bg-muted/40 animate-pulse" />
        </div>

        {/* Episode thumbnails row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-video w-full rounded-lg bg-muted/60 animate-pulse" />
              <div className="h-3 w-3/4 rounded-md bg-muted/50 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-md bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Subtle shimmer sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.2s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        style={{ width: '50%' }}
      />
      <style>{`@keyframes shimmer { 0%{transform:translateX(-100%);} 100%{transform:translateX(300%);} }`}</style>
    </div>
  );
}
