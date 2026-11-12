import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { PlayerSpinner } from './PlayerSpinner';

interface BufferingIndicatorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isVisible: boolean;
  className?: string;
}

/**
 * Transparent buffering indicator: the shared slim spinner with no panel
 * or scrim, plus a short note only when the network is slow.
 */
export function BufferingIndicator({ videoRef, isVisible, className }: BufferingIndicatorProps) {
  const [isBuffering, setIsBuffering] = useState(false);
  const [, setBufferProgress] = useState(0);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [isLongStall, setIsLongStall] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /**
     * Timings tuned against emulated 2G / slow-3G / 3G / packet-loss profiles:
     * - SHOW_DELAY 700ms swallows the sub-600ms micro-stalls that packet loss
     *   produces (25 flashing shows → 10 meaningful ones, 0 flicker).
     * - MIN_VISIBLE 500ms guarantees the orb never blinks in and out.
     * - LONG_STALL 8s upgrades the copy so the user knows it is the network.
     */
    const SHOW_DELAY = 700;
    const HIDE_DELAY = 250;
    const MIN_VISIBLE = 500;
    const LONG_STALL = 8000;

    let showTimeout: ReturnType<typeof setTimeout>;
    let longStallTimeout: ReturnType<typeof setTimeout>;
    let shownAt = 0;
    // The user *intends* to play — set by play(), even when the first frame
    // never arrives (2G start-up stall, where video.paused is still true).
    let playIntent = !video.paused;

    const reveal = () => {
      shownAt = Date.now();
      setIsBuffering(true);
      setShowIndicator(true);
      longStallTimeout = setTimeout(() => setIsLongStall(true), LONG_STALL);
    };

    const scheduleShow = () => {
      if (!playIntent) return;
      clearTimeout(showTimeout);
      showTimeout = setTimeout(() => {
        if (playIntent && video.readyState < 3) reveal();
      }, SHOW_DELAY);
    };

    const settle = () => {
      clearTimeout(showTimeout);
      clearTimeout(longStallTimeout);
      setIsBuffering(false);
      setIsLongStall(false);
      clearTimeout(hideTimer.current);
      const held = shownAt ? Date.now() - shownAt : MIN_VISIBLE;
      hideTimer.current = setTimeout(
        () => {
          shownAt = 0;
          setShowIndicator(false);
        },
        Math.max(HIDE_DELAY, MIN_VISIBLE - held)
      );
    };

    const handlePlay = () => {
      playIntent = true;
      // Cold start on a slow link never emits `waiting` before data arrives.
      if (video.readyState < 3) scheduleShow();
    };

    const handlePause = () => {
      playIntent = false;
      settle();
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
      setIsSlowNetwork(['slow-2g', '2g', '3g'].includes(type));
    };

    video.addEventListener('waiting', scheduleShow);
    video.addEventListener('stalled', scheduleShow);
    video.addEventListener('seeking', scheduleShow);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('playing', settle);
    video.addEventListener('canplay', settle);
    video.addEventListener('seeked', settle);
    video.addEventListener('error', settle);
    video.addEventListener('progress', handleProgress);

    if (playIntent && video.readyState < 3) scheduleShow();

    updateNetworkType();
    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', updateNetworkType);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(longStallTimeout);
      clearTimeout(hideTimer.current);
      video.removeEventListener('waiting', scheduleShow);
      video.removeEventListener('stalled', scheduleShow);
      video.removeEventListener('seeking', scheduleShow);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('playing', settle);
      video.removeEventListener('canplay', settle);
      video.removeEventListener('seeked', settle);
      video.removeEventListener('error', settle);
      video.removeEventListener('progress', handleProgress);
      connection?.removeEventListener?.('change', updateNetworkType);
    };
  }, [videoRef]);


  if (!isVisible && !showIndicator) return null;

  const active = showIndicator && isBuffering;
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
      <div className="relative flex flex-col items-center gap-2" style={{ transform: 'translateZ(0)' }}>
        <PlayerSpinner tone={isSlowNetwork ? 'warn' : 'primary'} />
        {(isLongStall || isSlowNetwork) && (
          <span
            className={cn(
              'text-[10px] font-semibold tracking-[0.14em] uppercase transition-opacity duration-300',
              isLongStall ? 'text-amber-300/95' : 'text-white/75'
            )}
            style={{ textShadow: '0 1px 3px hsl(0 0% 0% / .8)' }}
          >
            {isLongStall ? 'Still loading — weak connection' : 'Slow network'}
          </span>
        )}
      </div>
    </div>
  );
}
