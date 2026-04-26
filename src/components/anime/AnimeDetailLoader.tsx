import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Film, Image as ImageIcon, ListVideo, Check } from 'lucide-react';
import logo from '@/assets/logo.png';

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

  const stages = [
    { threshold: 25, label: 'Connecting', icon: Loader2 },
    { threshold: 55, label: 'Fetching details', icon: Film },
    { threshold: 80, label: 'Loading episodes', icon: ListVideo },
    { threshold: 100, label: 'Preparing artwork', icon: ImageIcon },
  ];

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
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-30 blur-3xl"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.22),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40 animate-pulse"
            style={{
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative z-10 w-[90%] max-w-md rounded-3xl border border-border/50 bg-card/85 backdrop-blur-2xl shadow-2xl shadow-black/50 p-6 sm:p-7 overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent">
          <div
            className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_20px_hsl(var(--primary))]"
            style={{ width: `${percent}%`, transition: 'width 150ms linear' }}
          />
        </div>

        {/* Brand row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/40 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="" className="h-9 w-9 object-contain animate-pulse" />
            <span className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
              Now Loading
            </p>
            <p className="text-sm font-bold text-foreground line-clamp-1">
              {title || 'More info'}
            </p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            4K
          </div>
        </div>

        {/* Percentage */}
        <div className="flex items-end justify-between mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl sm:text-7xl font-black text-foreground tabular-nums tracking-tighter leading-none bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              {display}
            </span>
            <span className="text-2xl font-bold text-muted-foreground">%</span>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-foreground transition-all block">{stage}</span>
            <span className="text-[10px] text-muted-foreground">Cinematic stream</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 w-full rounded-full bg-muted/50 overflow-hidden mb-5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-primary/70 shadow-[0_0_18px_hsl(var(--primary)/0.8)] transition-[width] duration-150 ease-out"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-0 w-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{
              left: `calc(${percent}% - 80px)`,
              transition: 'left 150ms linear',
            }}
          />
        </div>

        {/* Stage list */}
        <div className="space-y-1.5">
          {stages.map(({ threshold, label, icon: Icon }) => {
            const done = percent >= threshold;
            const active = !done && percent >= (threshold - 25);
            return (
              <div
                key={threshold}
                className={`flex items-center gap-2.5 text-[11px] font-medium transition-all ${
                  done ? 'text-foreground' : active ? 'text-foreground/80' : 'text-muted-foreground/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  done
                    ? 'bg-primary text-primary-foreground scale-100'
                    : active
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40 scale-100'
                    : 'bg-muted/40 text-muted-foreground scale-90'
                }`}>
                  {done ? <Check className="h-3 w-3" /> : <Icon className={`h-2.5 w-2.5 ${active ? 'animate-spin' : ''}`} />}
                </div>
                <span className="flex-1">{label}</span>
                {done && <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Done</span>}
                {active && <span className="text-[9px] font-bold text-primary uppercase tracking-wider animate-pulse">Live</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
