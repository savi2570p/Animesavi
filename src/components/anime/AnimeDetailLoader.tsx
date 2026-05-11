import { useEffect, useState } from 'react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Cinematic loading screen for the Anime Detail page.
 * Uses the anime's own backdrop as a parallax hero, with an orbital
 * ring loader, animated brand mark, progress bar with stage labels,
 * and skeleton episode rail.
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(6);

  const stages = [
    { at: 0, label: 'Connecting to server' },
    { at: 25, label: 'Fetching metadata' },
    { at: 55, label: 'Loading episodes' },
    { at: 80, label: 'Preparing playback' },
    { at: 95, label: 'Almost there' },
  ];
  const currentStage = stages.reduce((acc, s) => (progress >= s.at ? s : acc), stages[0]);

  useEffect(() => {
    if (isReady) {
      setProgress(100);
      const t = setTimeout(() => setHidden(true), 380);
      return () => clearTimeout(t);
    }
    let stallUntil = 0;
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 94) return p;
        // Occasional micro-stalls to feel like real network activity
        if (Date.now() < stallUntil) return p;
        if (Math.random() < 0.06 && p > 18) {
          stallUntil = Date.now() + 400 + Math.random() * 600;
          return p;
        }
        // Variable step: faster early, slower past 70%, with jitter
        const remaining = 94 - p;
        const ease = p < 30 ? 0.18 : p < 70 ? 0.11 : 0.05;
        const jitter = (Math.random() - 0.3) * 0.8;
        const step = Math.max(0.25, remaining * ease + jitter);
        return Math.min(94, p + step);
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [isReady]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden bg-background transition-opacity duration-400 ${
        isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-busy="true"
      aria-label={title ? `Loading ${title}` : 'Loading anime details'}
    >
      {/* Cinematic backdrop */}
      <div className="absolute inset-0">
        {backdrop ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center scale-110"
              style={{
                backgroundImage: `url(${backdrop})`,
                filter: 'blur(28px) saturate(1.2) brightness(0.55)',
                animation: 'kenburns 12s ease-in-out infinite alternate',
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-card animate-pulse" />
        )}
        {/* Vignette + brand wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/40 to-background" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 30%, hsl(var(--background)) 95%), radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.18), transparent 50%)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          }}
        />
      </div>

      {/* Top scan lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Center cluster */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div className="w-full max-w-md flex flex-col items-center gap-7 text-center">
          {/* Orbital loader */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 120 120"
              style={{ animation: 'spin 5s linear infinite' }}
            >
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
                strokeDasharray="4 8"
                opacity="0.5"
              />
            </svg>
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 120 120"
              style={{ animation: 'spin 2.4s cubic-bezier(0.4,0,0.6,1) infinite' }}
            >
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeDasharray="60 240"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.7))' }}
              />
            </svg>
            <span className="absolute inset-6 rounded-full border border-primary/30 animate-ping" />
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(330 80% 55% / 0.4))',
                boxShadow: '0 0 40px hsl(var(--primary) / 0.55)',
              }}
            >
              <span className="text-2xl drop-shadow">🎬</span>
            </div>
          </div>

          {/* Title block */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary">
              Now loading
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight max-w-sm mx-auto line-clamp-2">
              {title || 'Preparing your stream'}
            </h2>
            <p className="text-[11px] text-muted-foreground font-semibold tracking-wider uppercase flex items-center justify-center gap-2">
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              {currentStage.label}
              <span
                className="w-1 h-1 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: '0.3s' }}
              />
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div
              className="relative h-1.5 w-full rounded-full overflow-hidden border border-border/40"
              style={{ background: 'hsl(var(--card) / 0.6)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(var(--primary)), hsl(330 85% 60%), hsl(var(--primary)))',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-bar 2s linear infinite',
                  boxShadow: '0 0 12px hsl(var(--primary) / 0.7)',
                }}
              />
              <div
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.3), transparent)',
                  animation: 'sweep 1.6s ease-in-out infinite',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold tabular-nums">
              <span className="text-foreground/90">{Math.round(progress)}%</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(142_72%_45%)]" />
                4K · H.Savi
              </span>
            </div>
          </div>

          {/* Episode skeleton rail */}
          <div className="w-full pt-2">
            <div className="flex gap-2 overflow-hidden justify-center">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 w-24 rounded-md bg-card/50 border border-border/30 animate-pulse shrink-0"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer-bar { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes sweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes kenburns { 0%{transform:scale(1.1) translate(0,0)} 100%{transform:scale(1.18) translate(-1.5%, -1%)} }
      `}</style>
    </div>
  );
}
