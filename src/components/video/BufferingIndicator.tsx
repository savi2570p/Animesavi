import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BufferingIndicatorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isVisible: boolean;
  className?: string;
}

/**
 * Liquid-glass buffering indicator.
 * A single compact glass orb with an aurora halo and a live buffer-health arc.
 * No boxy panel, no percentage spam — it reads as part of the player, not on top of it.
 */
export function BufferingIndicator({ videoRef, isVisible, className }: BufferingIndicatorProps) {
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let bufferingTimeout: ReturnType<typeof setTimeout>;
    let wasPlaying = false;

    const handleWaiting = () => {
      wasPlaying = !video.paused;
      bufferingTimeout = setTimeout(() => {
        if (wasPlaying) {
          setIsBuffering(true);
          setShowIndicator(true);
        }
      }, 450);
    };

    const settle = () => {
      clearTimeout(bufferingTimeout);
      setIsBuffering(false);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowIndicator(false), 320);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const t = video.currentTime;
        let bufferedEnd = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= t && video.buffered.end(i) >= t) {
            bufferedEnd = video.buffered.end(i);
            break;
          }
        }
        setBufferProgress(Math.min(100, ((bufferedEnd - t) / 30) * 100));
      }
    };

    const updateNetworkType = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;
      const type = connection?.effectiveType || connection?.type || 'unknown';
      setIsSlowNetwork(['slow-2g', '2g'].includes(type));
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', settle);
    video.addEventListener('canplay', settle);
    video.addEventListener('progress', handleProgress);

    updateNetworkType();
    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', updateNetworkType);

    return () => {
      clearTimeout(bufferingTimeout);
      clearTimeout(hideTimer.current);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', settle);
      video.removeEventListener('canplay', settle);
      video.removeEventListener('progress', handleProgress);
      connection?.removeEventListener?.('change', updateNetworkType);
    };
  }, [videoRef]);

  if (!isVisible && !showIndicator) return null;

  const active = showIndicator && isBuffering;
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={active ? 'Buffering' : undefined}
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center pointer-events-none transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ contain: 'layout paint' }}
    >
      <div className="relative flex flex-col items-center gap-2.5" style={{ transform: 'translateZ(0)' }}>
        <div className="relative">
          {/* aurora halo */}
          <div
            className="absolute inset-0 -m-4 rounded-full blur-xl opacity-70"
            style={{
              background:
                'conic-gradient(from 0deg, hsl(var(--primary) / 0.6), hsl(280 90% 65% / 0.45), hsl(200 90% 62% / 0.4), hsl(var(--primary) / 0.6))',
              animation: 'bi-spin 5.5s linear infinite',
            }}
          />

          {/* glass orb */}
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 32% 26%, hsl(0 0% 100% / 0.5), hsl(0 0% 100% / 0.05) 58%, hsl(var(--primary) / 0.24))',
              border: '1px solid hsl(0 0% 100% / 0.22)',
              backdropFilter: 'blur(14px) saturate(180%)',
              WebkitBackdropFilter: 'blur(14px) saturate(180%)',
              boxShadow:
                'inset 0 1px 6px hsl(0 0% 100% / 0.45), inset 0 -10px 20px hsl(var(--primary) / 0.28), 0 10px 30px hsl(0 0% 0% / 0.45)',
            }}
          >
            {/* buffer health ring */}
            <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="32" cy="32" r={R} fill="none" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="2.5" />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke={isSlowNetwork ? 'hsl(38 95% 60%)' : 'hsl(var(--primary))'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (bufferProgress / 100) * CIRC}
                style={{
                  transition: 'stroke-dashoffset 400ms ease-out',
                  filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.7))',
                }}
              />
            </svg>

            {/* sweeping arc */}
            <svg
              viewBox="0 0 64 64"
              className="absolute inset-0 w-full h-full"
              style={{ animation: 'bi-spin 1.05s linear infinite' }}
            >
              <circle
                cx="32"
                cy="32"
                r="19"
                fill="none"
                stroke="hsl(0 0% 100% / 0.85)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="26 94"
              />
            </svg>

            {/* pulsing core */}
            <span
              className="block w-1.5 h-1.5 rounded-full bg-white/90"
              style={{ animation: 'bi-pulse 1.4s ease-in-out infinite' }}
            />
          </div>
        </div>

        {isSlowNetwork && (
          <span className="text-[10px] font-medium tracking-[0.16em] uppercase text-amber-300/90 drop-shadow">
            Slow network
          </span>
        )}
      </div>

      <style>{`
        @keyframes bi-spin { to { transform: rotate(360deg); } }
        @keyframes bi-pulse {
          0%, 100% { opacity: .35; transform: scale(.8); }
          50% { opacity: 1; transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
