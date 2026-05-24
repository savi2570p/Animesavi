import { ShieldAlert, Radio } from 'lucide-react';

interface SecurityOverlayProps {
  visible: boolean;
  message?: string;
  subtitle?: string;
  /** When true, removes the "Return Home" button so the overlay cannot be dismissed. */
  unclosable?: boolean;
}

/**
 * Fullscreen cyber-red warning overlay. Used for screen-recording / devtools trips.
 * When `unclosable` is true the user cannot dismiss it — only stopping the
 * offending action (recording / devtools) auto-clears the lock.
 */
export function SecurityOverlay({
  visible,
  message = 'Screen Recording Detected',
  subtitle = 'Please Stop Screen Recording To Continue Watching',
  unclosable = true,
}: SecurityOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[2147483647] flex flex-col items-center justify-center text-center bg-black overflow-hidden select-none"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at center, hsl(0 85% 12% / 0.85) 0%, hsl(0 0% 0% / 0.98) 70%),' +
          'repeating-linear-gradient(0deg, hsl(0 85% 50% / 0.07) 0 2px, transparent 2px 4px)',
      }}
    >
      {/* Outer red glow */}
      <div
        className="absolute inset-0 pointer-events-none animate-pulse"
        style={{
          boxShadow: 'inset 0 0 260px 60px hsl(0 95% 50% / 0.55)',
        }}
      />
      {/* Scanning line */}
      <div
        aria-hidden
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(0 95% 60% / 0.9), transparent)',
          boxShadow: '0 0 18px 2px hsl(0 95% 55% / 0.9)',
          animation: 'rec-scan 2.4s linear infinite',
          top: '0%',
        }}
      />
      <style>{`
        @keyframes rec-scan {
          0%   { top: 0%;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes rec-ping {
          0%, 100% { transform: scale(1);   opacity: 0.9; }
          50%      { transform: scale(1.15); opacity: 1; }
        }
      `}</style>

      <div
        className="relative mb-6"
        style={{ animation: 'rec-ping 1.4s ease-in-out infinite' }}
      >
        <ShieldAlert
          className="h-20 w-20 md:h-24 md:w-24 text-red-500"
          style={{ filter: 'drop-shadow(0 0 22px hsl(0 95% 55% / 0.95))' }}
        />
        <Radio className="absolute -top-1 -right-1 h-6 w-6 text-red-300 animate-pulse" />
      </div>

      <div className="flex items-center gap-2 text-red-400/90 mb-3 text-[11px] md:text-xs uppercase tracking-[0.35em]">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Security Lock Engaged
      </div>

      <h1
        className="px-6 text-2xl md:text-5xl font-black tracking-tight text-red-400"
        style={{
          textShadow: '0 0 14px hsl(0 95% 55% / 0.85), 0 0 32px hsl(0 95% 45% / 0.6)',
          fontSize: 'clamp(22px, 5.5vw, 56px)',
          lineHeight: 1.15,
        }}
      >
        {message}
      </h1>

      <p
        className="mt-4 max-w-xl text-red-100/85 px-6"
        style={{ fontSize: 'clamp(13px, 2.6vw, 18px)', lineHeight: 1.45 }}
      >
        {subtitle}
      </p>

      <div className="mt-8 px-6 py-2 rounded-full border border-red-500/50 text-red-200 text-[10px] md:text-xs uppercase tracking-[0.3em] bg-red-500/5 backdrop-blur">
        Playback will resume automatically
      </div>

      {!unclosable && (
        <button
          onClick={() => window.location.replace('/')}
          className="mt-6 px-6 py-2 rounded-md border border-red-500/60 text-red-200 hover:bg-red-500/10 transition-colors text-sm uppercase tracking-widest"
        >
          Return Home
        </button>
      )}
    </div>
  );
}
