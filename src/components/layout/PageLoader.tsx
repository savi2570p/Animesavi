import { useEffect, useState } from 'react';

interface PageLoaderProps {
  label?: string;
  accent?: string; // tailwind color, e.g. "orange-500" or "rose-500"
  logo?: string;
  done?: boolean;  // when parent finishes data fetch, accelerate to 100
}

/**
 * Realistic progress loader used for /crunchy and /musein.
 * Uses non-linear easing with random stalls so it feels organic
 * even when the underlying fetch is fast.
 */
export function PageLoader({ label = 'Loading', accent = 'primary', logo, done = false }: PageLoaderProps) {
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    let stallUntil = 0;
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (done) return Math.min(100, p + Math.max(4, (100 - p) * 0.35));
        if (p >= 92) return p;
        if (Date.now() < stallUntil) return p;
        if (Math.random() < 0.07 && p > 22) {
          stallUntil = Date.now() + 350 + Math.random() * 550;
          return p;
        }
        const step = Math.max(0.3, (92 - p) * (p < 35 ? 0.16 : 0.05) + (Math.random() - 0.35));
        return Math.min(92, p + step);
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [done]);

  const accentClass = accent.startsWith('hsl') ? '' : '';
  const barStyle = accent.includes('orange')
    ? 'from-orange-400 via-amber-400 to-orange-500'
    : accent.includes('rose')
      ? 'from-rose-400 via-pink-500 to-rose-500'
      : 'from-primary via-primary to-primary';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.08),transparent_70%)] pointer-events-none" />
      <div className="relative flex flex-col items-center gap-5 w-[min(360px,82vw)] px-6">
        {logo ? (
          <div className="relative">
            <div className="absolute inset-0 blur-2xl rounded-full opacity-40 bg-current" style={{ color: 'currentColor' }} />
            <img src={logo} alt="" className="relative h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10 shadow-xl animate-pulse" />
          </div>
        ) : null}
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground/90">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-[0.2em]">Preparing premium content</p>
        </div>
        <div className="w-full">
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barStyle} transition-[width] duration-300 ease-out shadow-[0_0_12px_currentColor]`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{label}…</span>
            <span className="tabular-nums text-foreground/80">{Math.floor(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
