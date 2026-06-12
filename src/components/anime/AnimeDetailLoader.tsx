import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Cinematic loading screen for the Anime Detail page.
 * Large percentage readout, animated bar, stage checklist, and
 * skeleton episode rail layered over the anime's own backdrop.
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(4);

  const stages = [
    { at: 0, label: 'Connecting to server' },
    { at: 22, label: 'Fetching metadata' },
    { at: 48, label: 'Loading episodes' },
    { at: 72, label: 'Preparing playback' },
    { at: 92, label: 'Finalizing' },
  ];

  useEffect(() => {
    if (isReady) {
      setProgress(100);
      const t = setTimeout(() => setHidden(true), 420);
      return () => clearTimeout(t);
    }
    let stallUntil = 0;
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 94) return p;
        if (Date.now() < stallUntil) return p;
        if (Math.random() < 0.06 && p > 18) {
          stallUntil = Date.now() + 350 + Math.random() * 500;
          return p;
        }
        const ease = p < 30 ? 0.18 : p < 70 ? 0.1 : 0.045;
        const jitter = (Math.random() - 0.3) * 0.7;
        const step = Math.max(0.25, (94 - p) * ease + jitter);
        return Math.min(94, p + step);
      });
    }, 170);
    return () => window.clearInterval(id);
  }, [isReady]);

  if (hidden) return null;

  const pctInt = Math.round(progress);

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
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backdrop})`,
              filter: 'blur(28px) brightness(0.5) saturate(1.15)',
              transform: 'scale(1.15)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-card animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 35%, transparent 0%, hsl(var(--background) / 0.85) 70%), radial-gradient(circle at 20% 15%, hsl(var(--primary) / 0.22), transparent 55%), radial-gradient(circle at 80% 80%, hsl(330 80% 55% / 0.18), transparent 55%)',
          }}
        />
      </div>

      {/* Scan lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div className="w-full max-w-lg flex flex-col items-center gap-6 text-center">
          {/* Brand label */}
          <p className="text-[10px] font-black tracking-[0.4em] uppercase text-primary">
            Anime · Savi
          </p>

          {/* Title */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-foreground/60">
              Now Loading
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight max-w-md mx-auto line-clamp-2">
              {title || 'Preparing your stream'}
            </h2>
          </div>

          {/* Huge percentage display */}
          <div className="flex items-baseline gap-1 tabular-nums">
            <span
              className="text-6xl sm:text-7xl font-black leading-none"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(330 90% 65%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 40px hsl(var(--primary) / 0.4)',
                filter: 'drop-shadow(0 0 18px hsl(var(--primary) / 0.35))',
              }}
            >
              {pctInt}
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-foreground/40">%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div
              className="relative h-2 w-full rounded-full overflow-hidden border border-border/40"
              style={{ background: 'hsl(var(--card) / 0.7)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, hsl(var(--primary)), hsl(330 90% 65%), hsl(var(--primary)))',
                  backgroundSize: '200% 100%',
                  animation: 'adl-shimmer 1.8s linear infinite',
                  boxShadow: '0 0 14px hsl(var(--primary) / 0.7)',
                }}
              />
              <div
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent)',
                  animation: 'adl-sweep 1.6s ease-in-out infinite',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                Streaming engine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(142_72%_45%)]" />
                4K · H.Savi
              </span>
            </div>
          </div>

          {/* Stage checklist */}
          <div className="w-full grid grid-cols-1 gap-1.5 max-w-sm">
            {stages.map((s, i) => {
              const done = progress >= (stages[i + 1]?.at ?? 100);
              const active = !done && progress >= s.at;
              return (
                <div
                  key={s.label}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    done
                      ? 'text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20'
                      : active
                      ? 'text-foreground bg-primary/10 border border-primary/30'
                      : 'text-muted-foreground/50 bg-card/30 border border-border/30'
                  }`}
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {done ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : active ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                    )}
                  </span>
                  <span className="flex-1 text-left">{s.label}</span>
                  {done && <span className="text-[9px] uppercase tracking-wider">Done</span>}
                </div>
              );
            })}
          </div>

          {/* Episode skeleton rail */}
          <div className="w-full pt-1">
            <div className="flex gap-2 overflow-hidden justify-center">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 w-24 rounded-md bg-card/50 border border-border/30 animate-pulse shrink-0"
                  style={{ animationDelay: `${i * 110}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes adl-shimmer { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes adl-sweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
      `}</style>
    </div>
  );
}
