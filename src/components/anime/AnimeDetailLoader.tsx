import { useEffect, useState } from 'react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Liquid-glass minimal loader for the Anime Detail page.
 * Frosted glass card over blurred backdrop. No percentage, no checklist —
 * just a soft shimmer bar, a two-line status, and a screen-reader label.
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isReady) {
      const t = setTimeout(() => setHidden(true), 380);
      return () => clearTimeout(t);
    }
  }, [isReady]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden transition-opacity duration-300 ${
        isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!isReady}
      aria-label={title ? `Loading ${title}` : 'Loading anime details'}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0">
        {backdrop ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backdrop})`,
              filter: 'blur(38px) brightness(0.45) saturate(1.2)',
              transform: 'scale(1.2)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background via-card/60 to-background" />
        )}
        <div className="absolute inset-0 bg-background/50" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.18), transparent 55%), radial-gradient(circle at 75% 80%, hsl(330 90% 60% / 0.14), transparent 55%)',
          }}
        />
      </div>

      {/* Liquid glass card */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div
          className="relative w-full max-w-sm rounded-3xl border border-white/12 px-6 py-8 flex flex-col items-center gap-5 text-center overflow-hidden"
          style={{
            background:
              'linear-gradient(140deg, hsl(0 0% 100% / 0.09), hsl(0 0% 100% / 0.03) 55%, hsl(var(--primary) / 0.06))',
            backdropFilter: 'blur(22px) saturate(180%)',
            WebkitBackdropFilter: 'blur(22px) saturate(180%)',
            boxShadow:
              '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 hsl(0 0% 100% / 0.12), inset 0 -1px 0 hsl(0 0% 0% / 0.25)',
          }}
        >
          {/* Specular sheen */}
          <div
            className="absolute inset-x-0 -top-1/2 h-full pointer-events-none opacity-60"
            style={{
              background:
                'linear-gradient(180deg, hsl(0 0% 100% / 0.15), transparent)',
              filter: 'blur(6px)',
            }}
          />

          {/* Pulsing orb */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-70"
              style={{ background: 'hsl(var(--primary) / 0.55)' }}
            />
            <div
              className="relative w-14 h-14 rounded-full flex items-center justify-center border border-white/15"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, hsl(0 0% 100% / 0.35), hsl(var(--primary) / 0.65) 60%, hsl(var(--primary) / 0.9))',
                boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.4), 0 8px 24px hsl(var(--primary) / 0.5)',
                animation: 'adl-breathe 2.2s ease-in-out infinite',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-foreground/60">
              Now Loading
            </p>
            <h2 className="text-lg sm:text-xl font-bold leading-snug line-clamp-2 text-foreground/95">
              {title || 'Preparing your stream'}
            </h2>
          </div>

          {/* Shimmer bar (indeterminate) */}
          <div
            className="relative h-1 w-full rounded-full overflow-hidden"
            style={{ background: 'hsl(0 0% 100% / 0.08)' }}
          >
            <div
              className="absolute inset-y-0 w-2/5 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.9), hsl(330 90% 65% / 0.9), transparent)',
                animation: 'adl-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                boxShadow: '0 0 12px hsl(var(--primary) / 0.7)',
              }}
            />
          </div>

          <p className="text-[10px] text-foreground/45 tracking-[0.2em] uppercase">
            Streaming engine · 4K
          </p>
        </div>
      </div>

      <span className="sr-only">
        {isReady ? 'Content loaded' : 'Loading anime details, please wait.'}
      </span>

      <style>{`
        @keyframes adl-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes adl-breathe {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
