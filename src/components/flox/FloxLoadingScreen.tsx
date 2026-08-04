import { useEffect, useRef, useState } from 'react';
import floxLogo from '@/assets/flox-anime-india-logo.jpg';

interface FloxLoadingScreenProps {
  /** When true, the loader eases to 100% and fades out. */
  ready: boolean;
  onDone?: () => void;
}

/**
 * Liquid-glass boot screen for the /flox tab with a real percentage counter.
 * Progress creeps toward 90% while data loads, then snaps to 100% on ready.
 */
export function FloxLoadingScreen({ ready, onDone }: FloxLoadingScreenProps) {
  const [progress, setProgress] = useState(4);
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      const delta = Math.min(64, now - (lastRef.current || now));
      lastRef.current = now;
      setProgress((p) => {
        const ceiling = ready ? 100 : 92;
        if (p >= ceiling) return ceiling;
        // Faster at the start, slower near the ceiling — feels like a real load.
        const speed = ready ? 0.22 : 0.055 * (1 - p / 120);
        return Math.min(ceiling, p + delta * speed);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready]);

  // Start the fade exactly once; the timeout must not be torn down by the
  // re-render that `setFading(true)` itself triggers (that used to leave an
  // invisible full-screen overlay mounted, blocking every click on /flox).
  const fadeStartedRef = useRef(false);
  useEffect(() => {
    if (fadeStartedRef.current) return;
    if (progress >= 99.5 && ready) {
      fadeStartedRef.current = true;
      setFading(true);
      const t = setTimeout(() => {
        setHidden(true);
        onDone?.();
      }, 520);
      return () => clearTimeout(t);
    }
  }, [progress, ready, onDone]);

  // Safety net: never let the boot overlay outlive the data load.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      fadeStartedRef.current = true;
      setHidden(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [ready]);


  if (hidden) return null;

  const pct = Math.round(progress);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading Flox Plus, ${pct} percent`}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, hsl(270 60% 12%) 0%, hsl(265 45% 6%) 45%, hsl(0 0% 3%) 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Ambient aurora orbs */}
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/25 blur-[90px] animate-pulse" />
      <div
        className="pointer-events-none absolute -bottom-28 -right-10 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[100px] animate-pulse"
        style={{ animationDelay: '1.1s' }}
      />

      {/* Glass core */}
      <div
        className="relative w-[min(88vw,380px)] rounded-[28px] border border-white/12 p-7 text-center shadow-2xl shadow-black/60"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        }}
      >
        {/* Logo with orbiting ring */}
        <div className="relative mx-auto mb-5 h-20 w-20">
          <span className="absolute inset-0 rounded-full border-2 border-primary/25" />
          <span
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
            style={{ animation: 'spin 1.1s linear infinite' }}
          />
          <img
            src={floxLogo}
            alt="Flox +"
            className="absolute inset-1.5 h-[68px] w-[68px] rounded-full object-cover shadow-lg shadow-primary/30"
          />
        </div>

        <h2 className="font-heading text-lg font-bold tracking-tight text-white">Flox +</h2>
        <p className="mt-1 text-xs text-white/60">Preparing your Hindi Dub library</p>

        {/* Percentage */}
        <div className="mt-5 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-black tabular-nums text-white drop-shadow-[0_4px_18px_hsl(var(--primary)/0.5)]">
            {pct}
          </span>
          <span className="text-lg font-bold text-white/50">%</span>
        </div>

        {/* Progress track */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-fuchsia-400 to-primary shadow-[0_0_14px_hsl(var(--primary)/0.8)]"
            style={{ width: `${pct}%`, transition: 'width 120ms linear' }}
          />
        </div>

        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
          {pct < 45 ? 'Connecting' : pct < 85 ? 'Loading titles' : 'Almost ready'}
        </p>
      </div>
    </div>
  );
}
