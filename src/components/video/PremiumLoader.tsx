import { cn } from '@/lib/utils';

interface PremiumLoaderProps {
  isVisible: boolean;
  className?: string;
}

/**
 * Liquid-glass video player loader.
 * Deep transparent glass orb over a subtle scrim so the frame beneath still
 * feels present. Uses GPU-only transforms so it stays smooth on iOS/Android.
 */
export function PremiumLoader({ isVisible, className }: PremiumLoaderProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      style={{
        background:
          'radial-gradient(circle at 50% 50%, hsl(0 0% 0% / 0.55), hsl(0 0% 0% / 0.85))',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div className="relative">
        {/* aurora halo */}
        <div
          className="absolute inset-0 -m-8 rounded-full blur-3xl opacity-70"
          style={{
            background:
              'conic-gradient(from 0deg, hsl(var(--primary) / 0.55), hsl(330 90% 60% / 0.4), hsl(200 90% 60% / 0.45), hsl(var(--primary) / 0.55))',
            animation: 'pl-spin 6s linear infinite',
          }}
        />

        {/* glass orb */}
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at 32% 28%, hsl(0 0% 100% / 0.55), hsl(0 0% 100% / 0.06) 55%, hsl(var(--primary) / 0.28))',
            border: '1px solid hsl(0 0% 100% / 0.28)',
            backdropFilter: 'blur(14px) saturate(180%)',
            WebkitBackdropFilter: 'blur(14px) saturate(180%)',
            boxShadow:
              'inset 0 2px 8px hsl(0 0% 100% / 0.5), inset 0 -10px 20px hsl(var(--primary) / 0.35), 0 20px 60px hsl(var(--primary) / 0.35)',
          }}
        >
          {/* arc spinner */}
          <svg viewBox="0 0 64 64" className="w-14 h-14" style={{ animation: 'pl-spin 1.1s linear infinite' }}>
            <defs>
              <linearGradient id="plGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="url(#plGlass)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="90 164"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.55))' }}
            />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes pl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
