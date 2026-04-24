import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface AnimeDetailLoaderProps {
  /** When true the parent's data is ready — loader animates to 100% then fades out. */
  isReady: boolean;
  /** Optional thumbnail to use as a blurred backdrop while loading. */
  backdrop?: string | null;
  /** Optional title for context. */
  title?: string;
}

/**
 * Realistic, percentage-based loader that simulates progressive loading
 * (eases up to ~92% on its own, then jumps to 100% once data is ready).
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [percent, setPercent] = useState(4);
  const [hidden, setHidden] = useState(false);
  const completedAt = useRef<number | null>(null);

  // Simulate progressive loading: fast at start, slows down, caps at 92.
  useEffect(() => {
    if (isReady) return;
    let raf: number;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      setPercent((p) => {
        if (p >= 92) return 92;
        // Decreasing speed curve — feels like real network progress
        const remaining = 92 - p;
        const speed = Math.max(0.018, remaining * 0.0009); // %/ms
        return Math.min(92, p + speed * dt);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isReady]);

  // When ready, race to 100% then fade out.
  useEffect(() => {
    if (!isReady) return;
    let raf: number;
    let last = performance.now();
    completedAt.current = completedAt.current ?? performance.now();

    const finish = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      setPercent((p) => {
        const next = Math.min(100, p + dt * 0.45); // ~220ms to reach 100
        return next;
      });
      raf = requestAnimationFrame((t) => {
        setPercent((p) => {
          if (p >= 100) {
            cancelAnimationFrame(raf);
            // small hold then unmount
            setTimeout(() => setHidden(true), 280);
            return 100;
          }
          return p;
        });
        if (raf) finish(t);
      });
    };
    raf = requestAnimationFrame(finish);
    return () => cancelAnimationFrame(raf);
  }, [isReady]);

  if (hidden) return null;

  const display = Math.floor(percent);
  const stage =
    display < 25
      ? 'Connecting…'
      : display < 55
      ? 'Fetching details'
      : display < 80
      ? 'Loading episodes'
      : display < 100
      ? 'Preparing artwork'
      : 'Ready';

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-300 ${
        percent >= 100 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${title || 'anime'} ${display}%`}
    >
      {/* Backdrop layers */}
      <div className="absolute inset-0 bg-background" />
      {backdrop && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-25 blur-3xl"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />

      {/* Card */}
      <div className="relative z-10 w-[88%] max-w-md rounded-2xl border border-border/50 bg-card/80 backdrop-blur-2xl shadow-2xl shadow-black/40 p-6 sm:p-7">
        {/* Brand row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative h-10 w-10 rounded-xl bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <span className="absolute -inset-1 rounded-xl bg-primary/20 blur-md animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Loading
            </p>
            <p className="text-sm font-semibold text-foreground line-clamp-1">
              {title || 'More info'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            HD
          </div>
        </div>

        {/* Percentage */}
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl sm:text-6xl font-black text-foreground tabular-nums tracking-tight">
              {display}
            </span>
            <span className="text-2xl font-bold text-muted-foreground">%</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground transition-all">{stage}</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-primary/70 shadow-[0_0_14px_hsl(var(--primary)/0.7)] transition-[width] duration-150 ease-out"
            style={{ width: `${percent}%` }}
          />
          {/* Sheen */}
          <div
            className="absolute inset-y-0 w-16 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{
              left: `calc(${percent}% - 64px)`,
              transition: 'left 150ms linear',
            }}
          />
        </div>

        {/* Stage dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {[25, 55, 80, 100].map((threshold) => (
            <span
              key={threshold}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                percent >= threshold ? 'bg-primary' : 'bg-muted/60'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
