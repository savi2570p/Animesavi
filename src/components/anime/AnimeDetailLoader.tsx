import { useEffect, useState } from 'react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Deep Liquid-Glass loader for the Anime Detail page.
 * Ultra-transparent layered glass with refraction sheen, chromatic edges,
 * floating orbs and a soft indeterminate shimmer. No percentage, no checklist.
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isReady) {
      const t = setTimeout(() => setHidden(true), 420);
      return () => clearTimeout(t);
    }
  }, [isReady]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden transition-opacity duration-500 ${
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
      {/* Backdrop — kept vivid so the glass truly looks transparent */}
      <div className="absolute inset-0">
        {backdrop ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${backdrop})`,
                filter: 'blur(48px) saturate(1.4) brightness(0.7)',
                transform: 'scale(1.25)',
              }}
            />
            {/* very light tint so image stays visible through glass */}
            <div className="absolute inset-0 bg-background/25" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background via-card/50 to-background" />
        )}

        {/* Floating aurora orbs — refraction targets for the glass */}
        <div
          className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 60%)',
            filter: 'blur(60px)',
            animation: 'adl-drift1 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-32 -right-24 w-[560px] h-[560px] rounded-full opacity-60"
          style={{
            background:
              'radial-gradient(circle, hsl(330 90% 60% / 0.45), transparent 60%)',
            filter: 'blur(70px)',
            animation: 'adl-drift2 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-[420px] h-[420px] rounded-full opacity-50 -translate-x-1/2"
          style={{
            background:
              'radial-gradient(circle, hsl(200 90% 60% / 0.35), transparent 60%)',
            filter: 'blur(80px)',
            animation: 'adl-drift3 16s ease-in-out infinite',
          }}
        />

        {/* subtle noise for optical realism */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>

      {/* Deep liquid glass card */}
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div
          className="relative w-full max-w-sm rounded-[28px] px-7 py-9 flex flex-col items-center gap-6 text-center overflow-hidden"
          style={{
            // near-transparent so the aurora shows through
            background:
              'linear-gradient(140deg, hsl(0 0% 100% / 0.06) 0%, hsl(0 0% 100% / 0.02) 45%, hsl(var(--primary) / 0.04) 100%)',
            backdropFilter: 'blur(30px) saturate(200%) brightness(1.05)',
            WebkitBackdropFilter: 'blur(30px) saturate(200%) brightness(1.05)',
            border: '1px solid hsl(0 0% 100% / 0.14)',
            boxShadow:
              '0 40px 100px -20px rgba(0,0,0,0.55), 0 2px 0 hsl(0 0% 100% / 0.06) inset, 0 -2px 40px hsl(var(--primary) / 0.08) inset',
          }}
        >
          {/* chromatic edge glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[28px] opacity-70"
            style={{
              padding: '1px',
              background:
                'linear-gradient(135deg, hsl(0 0% 100% / 0.4), transparent 30%, transparent 70%, hsl(var(--primary) / 0.35))',
              WebkitMask:
                'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          {/* moving specular highlight */}
          <div
            className="pointer-events-none absolute -inset-[1px] rounded-[28px] overflow-hidden"
            aria-hidden
          >
            <div
              className="absolute -top-1/2 left-0 w-full h-[200%] opacity-40"
              style={{
                background:
                  'linear-gradient(115deg, transparent 30%, hsl(0 0% 100% / 0.35) 50%, transparent 70%)',
                animation: 'adl-sheen 3.6s ease-in-out infinite',
              }}
            />
          </div>

          {/* Glass orb */}
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-full blur-2xl opacity-80"
              style={{ background: 'hsl(var(--primary) / 0.55)' }}
            />
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background:
                  'radial-gradient(circle at 30% 25%, hsl(0 0% 100% / 0.55), hsl(0 0% 100% / 0.05) 55%, hsl(var(--primary) / 0.35))',
                border: '1px solid hsl(0 0% 100% / 0.35)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow:
                  'inset 0 2px 6px hsl(0 0% 100% / 0.5), inset 0 -6px 12px hsl(var(--primary) / 0.4), 0 12px 30px hsl(var(--primary) / 0.45)',
                animation: 'adl-breathe 2.4s ease-in-out infinite',
              }}
            />
          </div>

          <div className="space-y-1.5 relative">
            <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-foreground/55">
              Now Loading
            </p>
            <h2 className="text-lg sm:text-xl font-semibold leading-snug line-clamp-2 text-foreground/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
              {title || 'Preparing your stream'}
            </h2>
          </div>

          {/* Shimmer bar (indeterminate) */}
          <div
            className="relative h-[3px] w-full rounded-full overflow-hidden"
            style={{
              background: 'hsl(0 0% 100% / 0.08)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="absolute inset-y-0 w-2/5 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.6), hsl(var(--primary) / 0.95), hsl(330 90% 65% / 0.9), transparent)',
                animation: 'adl-slide 1.7s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                boxShadow: '0 0 16px hsl(var(--primary) / 0.75)',
              }}
            />
          </div>

          <p className="text-[10px] text-foreground/50 tracking-[0.25em] uppercase relative">
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
        @keyframes adl-sheen {
          0% { transform: translateX(-40%) rotate(0deg); }
          100% { transform: translateX(40%) rotate(0deg); }
        }
        @keyframes adl-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.07); }
        }
        @keyframes adl-drift1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, 30px); }
        }
        @keyframes adl-drift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-50px, -20px); }
        }
        @keyframes adl-drift3 {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -40px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
