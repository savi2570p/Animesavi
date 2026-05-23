import { ShieldAlert } from 'lucide-react';

interface SecurityOverlayProps {
  visible: boolean;
  message?: string;
  subtitle?: string;
}

/**
 * Fullscreen red-neon warning overlay shown when anti-piracy is tripped.
 */
export function SecurityOverlay({
  visible,
  message = 'Inspection blocked',
  subtitle = 'Close developer tools or stop screen recording to resume playback.',
}: SecurityOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,30,30,0.06) 0 2px, transparent 2px 4px)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 200px 40px hsl(0 85% 50% / 0.45)',
        }}
      />
      <ShieldAlert className="h-16 w-16 text-red-500 mb-4 drop-shadow-[0_0_18px_hsl(0_85%_50%/0.9)]" />
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-red-400 drop-shadow-[0_0_12px_hsl(0_85%_50%/0.7)]">
        {message}
      </h1>
      <p className="mt-3 max-w-md text-sm md:text-base text-red-100/80 px-6">{subtitle}</p>
      <button
        onClick={() => window.location.replace('/')}
        className="mt-8 px-6 py-2 rounded-md border border-red-500/60 text-red-200 hover:bg-red-500/10 transition-colors text-sm uppercase tracking-widest"
      >
        Return Home
      </button>
    </div>
  );
}
