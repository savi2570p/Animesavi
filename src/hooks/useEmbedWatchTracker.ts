import { useEffect, useRef } from 'react';
import { historyResetSinceLoad } from '@/lib/watchHistoryReset';

interface Options {
  /** Episode id used to namespace localStorage. */
  episodeId: string | null | undefined;
  /** Estimated duration in seconds (use the episode's duration when available, else fallback). */
  estimatedDuration?: number;
  /** Fired every `tickMs` while the embed is considered "playing". `(currentTime, duration)` */
  onTick?: (currentTime: number, duration: number) => void;
  /** Called once when tracking actually starts after first user interaction. */
  onStart?: () => void;
  /** Enable / disable the tracker (e.g. only for the EMBED server). */
  enabled?: boolean;
  /** How often to flush progress to storage + onTick callback. Default 5000ms. */
  tickMs?: number;
}

/**
 * ULTRA BEAST EMBED CONTINUE WATCHING TRACKER
 *
 * External iframes (Streamtape / Doodstream / Upnshare / RPMShare / Filemoon / Vidguard…)
 * are cross-origin and block direct access to `currentTime`. This hook builds a smart
 * *estimating* watch session using:
 *   - first-interaction detection (click/touch inside the page = playback assumed to start)
 *   - visibilitychange / pagehide / blur to pause the timer
 *   - focus to resume
 *   - throttled flushes to localStorage so the next visit restores position
 *
 * Storage shape: localStorage["resume:<episodeId>"] = "<seconds>"
 * which is the same key Watch.tsx reads, so the existing "Resume from …" toast and
 * Continue Watching row pick it up automatically.
 */
export function useEmbedWatchTracker({
  episodeId,
  estimatedDuration,
  onTick,
  onStart,
  enabled = true,
  tickMs = 5000,
}: Options) {
  // Mutable refs — these survive renders without retriggering effects.
  const startedRef = useRef(false);          // has the session ever started?
  const playingRef = useRef(false);          // is the timer currently running?
  const accumulatedRef = useRef(0);          // total estimated seconds watched so far
  const lastResumeAtRef = useRef<number | null>(null); // performance.now() of last resume
  const intervalRef = useRef<number | null>(null);
  const visibleRef = useRef(typeof document === 'undefined' ? true : !document.hidden);

  useEffect(() => {
    if (!enabled || !episodeId) return;

    // Seed from the same localStorage key Watch.tsx uses, so progress is sticky
    // across visits even before the user interacts again.
    try {
      const raw = localStorage.getItem(`resume:${episodeId}`);
      const n = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(n) && n > 0) accumulatedRef.current = n;
    } catch {}

    const duration = Math.max(60, estimatedDuration || 24 * 60); // safe default = 24m

    const flush = () => {
      if (historyResetSinceLoad()) return;
      try {
        if (accumulatedRef.current > 5) {
          localStorage.setItem(`resume:${episodeId}`, String(Math.floor(accumulatedRef.current)));
        }
      } catch {}
      onTick?.(accumulatedRef.current, duration);
    };

    const resume = () => {
      if (!visibleRef.current) return;
      if (playingRef.current) return;
      playingRef.current = true;
      lastResumeAtRef.current = performance.now();
      if (!startedRef.current) {
        startedRef.current = true;
        onStart?.();
      }
    };

    const pause = () => {
      if (!playingRef.current) return;
      if (lastResumeAtRef.current != null) {
        const delta = (performance.now() - lastResumeAtRef.current) / 1000;
        // Guard against absurd values from sleeping tabs (>15min single chunk).
        accumulatedRef.current += Math.min(delta, 15 * 60);
      }
      playingRef.current = false;
      lastResumeAtRef.current = null;
      flush();
    };

    // First user interaction inside the page = embed playback assumed to begin.
    const onFirstInteract = () => {
      resume();
      window.removeEventListener('pointerdown', onFirstInteract, true);
      window.removeEventListener('keydown', onFirstInteract, true);
      window.removeEventListener('touchstart', onFirstInteract, true);
    };
    window.addEventListener('pointerdown', onFirstInteract, true);
    window.addEventListener('keydown', onFirstInteract, true);
    window.addEventListener('touchstart', onFirstInteract, true);

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      if (document.hidden) pause();
      else if (startedRef.current) resume();
    };
    const onPageHide = () => pause();
    const onBlur = () => pause();
    const onFocus = () => { if (startedRef.current) resume(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    // Periodic flush — accumulates a fresh slice without resetting the resume anchor.
    intervalRef.current = window.setInterval(() => {
      if (playingRef.current && lastResumeAtRef.current != null) {
        const delta = (performance.now() - lastResumeAtRef.current) / 1000;
        accumulatedRef.current += Math.min(delta, tickMs / 1000 + 2);
        lastResumeAtRef.current = performance.now();
        flush();
      }
    }, tickMs);

    return () => {
      pause();
      window.removeEventListener('pointerdown', onFirstInteract, true);
      window.removeEventListener('keydown', onFirstInteract, true);
      window.removeEventListener('touchstart', onFirstInteract, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      startedRef.current = false;
      playingRef.current = false;
      accumulatedRef.current = 0;
      lastResumeAtRef.current = null;
    };
    // estimatedDuration intentionally not a re-init trigger; ref math reads it via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, episodeId, tickMs]);
}
